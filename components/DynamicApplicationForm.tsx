'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { RealtimeChannel } from '@supabase/supabase-js'

interface FormQuestion {
  id: string
  question_text: string
  question_type: 'short_text' | 'long_text' | 'multiple_choice'
  is_required: boolean
  order_index: number
  settings: {
    word_limit?: number
    options?: string[]
    allow_multiple?: boolean
  }
}

interface OrgForm {
  id: string
  title: string
  description: string | null
}

interface DynamicApplicationFormProps {
  organizationId: string
  organizationName: string
  onSubmit: (data: { 
    name: string
    email: string
    whyJoin: string
    customResponses: Record<string, string | string[]>
  }) => Promise<void>
  onCancel: () => void
  loading?: boolean
  error?: string | null
}

export default function DynamicApplicationForm({
  organizationId,
  organizationName,
  onSubmit,
  onCancel,
  loading: externalLoading,
  error: externalError
}: DynamicApplicationFormProps) {
  const supabase = createClientComponentClient()
  const { user } = useAuth()
  
  const [form, setForm] = useState<OrgForm | null>(null)
  const [questions, setQuestions] = useState<FormQuestion[]>([])
  const [formLoading, setFormLoading] = useState(true)
  
  // Form data
  const [applicantName, setApplicantName] = useState('')
  const [applicantEmail, setApplicantEmail] = useState(user?.email || '')
  const [responses, setResponses] = useState<Record<string, string | string[]>>({})
  
  // Validation
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  
  // Draft saving
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch form and questions
  useEffect(() => {
    const fetchForm = async () => {
      setFormLoading(true)
      
      try {
        // Get the form for this org
        const { data: formData, error: formError } = await supabase
          .from('org_forms')
          .select('id, title, description')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .single()
        
        if (formError) {
          console.log('No custom form found, using default')
          setFormLoading(false)
          return
        }
        
        setForm(formData)
        
        // Get questions
        const { data: questionsData, error: questionsError } = await supabase
          .from('form_questions')
          .select('*')
          .eq('form_id', formData.id)
          .order('order_index', { ascending: true })
        
        if (!questionsError && questionsData) {
          setQuestions(questionsData)
        }
      } catch (err) {
        console.error('Error fetching form:', err)
      } finally {
        setFormLoading(false)
      }
    }
    
    fetchForm()
  }, [organizationId, supabase])

  // Realtime subscription for form questions (updates while form is open)
  const channelRef = useRef<RealtimeChannel | null>(null)
  
  useEffect(() => {
    if (!form) return
    
    const channel = supabase
      .channel(`applicant_form_${form.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'form_questions',
          filter: `form_id=eq.${form.id}`
        },
        (payload) => {
          console.log('📋 Form questions updated in realtime:', payload.eventType)
          
          if (payload.eventType === 'INSERT') {
            const newQ = payload.new as FormQuestion
            setQuestions(prev => {
              if (prev.some(q => q.id === newQ.id)) return prev
              return [...prev, newQ].sort((a, b) => a.order_index - b.order_index)
            })
          } else if (payload.eventType === 'UPDATE') {
            const updatedQ = payload.new as FormQuestion
            setQuestions(prev => 
              prev.map(q => q.id === updatedQ.id ? updatedQ : q)
                .sort((a, b) => a.order_index - b.order_index)
            )
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id
            if (deletedId) {
              setQuestions(prev => prev.filter(q => q.id !== deletedId))
              // Also remove response for deleted question
              setResponses(prev => {
                const newResponses = { ...prev }
                delete newResponses[deletedId]
                return newResponses
              })
            }
          }
        }
      )
      .subscribe()
    
    channelRef.current = channel
    
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [form, supabase])

  // Load draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      if (!user) return
      
      try {
        const { data: draft } = await supabase
          .from('application_drafts')
          .select('*')
          .eq('user_id', user.id)
          .eq('organization_id', organizationId)
          .single()
        
        if (draft) {
          setApplicantName(draft.applicant_name || '')
          setApplicantEmail(draft.applicant_email || user.email || '')
          setResponses(draft.draft_data || {})
          setLastSaved(new Date(draft.updated_at))
        }
      } catch (err) {
        // No draft found, that's okay
      }
    }
    
    loadDraft()
  }, [user, organizationId, supabase])

  // Pre-fill email
  useEffect(() => {
    if (user?.email && !applicantEmail) {
      setApplicantEmail(user.email)
    }
  }, [user, applicantEmail])

  // Autosave draft
  const saveDraft = useCallback(async () => {
    if (!user) return
    
    setIsSavingDraft(true)
    
    try {
      const { error } = await supabase
        .from('application_drafts')
        .upsert({
          user_id: user.id,
          organization_id: organizationId,
          applicant_name: applicantName,
          applicant_email: applicantEmail,
          draft_data: responses
        }, {
          onConflict: 'user_id,organization_id'
        })
      
      if (!error) {
        setLastSaved(new Date())
      }
    } catch (err) {
      console.error('Error saving draft:', err)
    } finally {
      setIsSavingDraft(false)
    }
  }, [user, organizationId, applicantName, applicantEmail, responses, supabase])

  // Debounced autosave
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      if (applicantName || applicantEmail || Object.keys(responses).length > 0) {
        saveDraft()
      }
    }, 2000) // Save after 2 seconds of inactivity
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [applicantName, applicantEmail, responses, saveDraft])

  // Count words in text
  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
  }

  // Update response
  const updateResponse = (questionId: string, value: string | string[]) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }))
    
    // Clear validation error for this field
    if (validationErrors[questionId]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[questionId]
        return newErrors
      })
    }
  }

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    
    if (!applicantName.trim()) {
      errors['name'] = 'Name is required'
    }
    
    if (!applicantEmail.trim()) {
      errors['email'] = 'Email is required'
    }
    
    // Validate custom questions
    for (const question of questions) {
      const response = responses[question.id]
      
      if (question.is_required) {
        if (!response || (typeof response === 'string' && !response.trim()) || (Array.isArray(response) && response.length === 0)) {
          errors[question.id] = 'This field is required'
          continue
        }
      }
      
      // Check word limit for long text
      if (question.question_type === 'long_text' && question.settings.word_limit && typeof response === 'string') {
        const wordCount = countWords(response)
        if (wordCount > question.settings.word_limit) {
          errors[question.id] = `Maximum ${question.settings.word_limit} words allowed (currently ${wordCount})`
        }
      }
    }
    
    // If no custom questions, validate default "why join" field
    if (questions.length === 0) {
      const whyJoin = responses['default_why_join'] as string
      if (!whyJoin?.trim()) {
        errors['default_why_join'] = 'This field is required'
      }
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    // Get the "why join" text - either from custom questions or default
    let whyJoin = ''
    if (questions.length > 0) {
      // Use first long_text question as "why join" or concatenate all responses
      const longTextQ = questions.find(q => q.question_type === 'long_text')
      if (longTextQ && responses[longTextQ.id]) {
        whyJoin = responses[longTextQ.id] as string
      } else {
        // Just use first response
        const firstResponse = Object.values(responses)[0]
        whyJoin = typeof firstResponse === 'string' ? firstResponse : JSON.stringify(firstResponse)
      }
    } else {
      whyJoin = responses['default_why_join'] as string || ''
    }
    
    await onSubmit({
      name: applicantName.trim(),
      email: applicantEmail.trim(),
      whyJoin,
      customResponses: responses
    })
    
    // Delete draft on successful submit
    if (user) {
      await supabase
        .from('application_drafts')
        .delete()
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
    }
  }

  // Calculate progress
  const totalFields = 2 + (questions.length > 0 ? questions.filter(q => q.is_required).length : 1) // name, email + required questions
  const completedFields = [
    applicantName.trim() ? 1 : 0,
    applicantEmail.trim() ? 1 : 0,
    ...(questions.length > 0 
      ? questions.filter(q => q.is_required).map(q => {
          const r = responses[q.id]
          return r && (typeof r === 'string' ? r.trim() : r.length > 0) ? 1 : 0
        })
      : [responses['default_why_join'] ? 1 : 0]
    )
  ].reduce((a, b) => a + b, 0)
  
  const progressPercent = Math.round((completedFields / totalFields) * 100)

  if (formLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tamu-maroon"></div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Progress Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Progress</span>
          <span className="text-sm text-gray-500">{progressPercent}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-tamu-maroon to-tamu-maroon-light"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Error Message */}
      {externalError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {externalError}
        </div>
      )}

      {/* Autosave indicator */}
      {lastSaved && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {isSavingDraft ? (
            <>
              <div className="w-3 h-3 border border-gray-300 border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Draft saved {lastSaved.toLocaleTimeString()}
            </>
          )}
        </div>
      )}

      {/* Basic Info */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Your Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={applicantName}
          onChange={(e) => {
            setApplicantName(e.target.value)
            if (validationErrors['name']) {
              setValidationErrors(prev => {
                const newErrors = { ...prev }
                delete newErrors['name']
                return newErrors
              })
            }
          }}
          placeholder="Enter your full name"
          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-1 ${
            validationErrors['name'] 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
              : 'border-gray-300 focus:border-tamu-maroon focus:ring-tamu-maroon'
          }`}
        />
        {validationErrors['name'] && (
          <p className="text-red-500 text-xs mt-1">{validationErrors['name']}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={applicantEmail}
          onChange={(e) => {
            setApplicantEmail(e.target.value)
            if (validationErrors['email']) {
              setValidationErrors(prev => {
                const newErrors = { ...prev }
                delete newErrors['email']
                return newErrors
              })
            }
          }}
          placeholder="your@email.com"
          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-1 ${
            validationErrors['email'] 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
              : 'border-gray-300 focus:border-tamu-maroon focus:ring-tamu-maroon'
          }`}
        />
        {validationErrors['email'] && (
          <p className="text-red-500 text-xs mt-1">{validationErrors['email']}</p>
        )}
      </div>

      {/* Custom Questions or Default */}
      {questions.length > 0 ? (
        questions.map((question, index) => (
          <QuestionField
            key={question.id}
            question={question}
            index={index}
            value={responses[question.id]}
            onChange={(value) => updateResponse(question.id, value)}
            error={validationErrors[question.id]}
          />
        ))
      ) : (
        // Default "Why join" field
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Why do you want to join? <span className="text-red-500">*</span>
          </label>
          <textarea
            value={(responses['default_why_join'] as string) || ''}
            onChange={(e) => updateResponse('default_why_join', e.target.value)}
            placeholder="Tell us why you're interested in joining..."
            rows={4}
            className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-1 resize-none ${
              validationErrors['default_why_join'] 
                ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                : 'border-gray-300 focus:border-tamu-maroon focus:ring-tamu-maroon'
            }`}
          />
          {validationErrors['default_why_join'] && (
            <p className="text-red-500 text-xs mt-1">{validationErrors['default_why_join']}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={externalLoading}
          className="flex-1 px-4 py-2 text-sm font-medium bg-tamu-maroon text-white rounded-lg hover:bg-tamu-maroon-light transition-colors disabled:opacity-50"
        >
          {externalLoading ? 'Submitting...' : 'Submit Application'}
        </button>
      </div>
    </form>
  )
}

// Individual Question Field Component
function QuestionField({
  question,
  index,
  value,
  onChange,
  error
}: {
  question: FormQuestion
  index: number
  value: string | string[] | undefined
  onChange: (value: string | string[]) => void
  error?: string
}) {
  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
  }

  const wordCount = question.question_type === 'long_text' && typeof value === 'string' 
    ? countWords(value) 
    : 0

  const isOverLimit = question.settings.word_limit && wordCount > question.settings.word_limit

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {question.question_text}
        {question.is_required && <span className="text-red-500"> *</span>}
      </label>

      {question.question_type === 'short_text' && (
        <input
          type="text"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your answer..."
          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-1 ${
            error 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
              : 'border-gray-300 focus:border-tamu-maroon focus:ring-tamu-maroon'
          }`}
        />
      )}

      {question.question_type === 'long_text' && (
        <>
          <textarea
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Your answer..."
            rows={4}
            className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-1 resize-none ${
              error || isOverLimit
                ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                : 'border-gray-300 focus:border-tamu-maroon focus:ring-tamu-maroon'
            }`}
          />
          {question.settings.word_limit && (
            <p className={`text-xs mt-1 ${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
              {wordCount} / {question.settings.word_limit} words
            </p>
          )}
        </>
      )}

      {question.question_type === 'multiple_choice' && question.settings.options && (
        <div className="space-y-2 mt-2">
          {question.settings.options.map((option, idx) => {
            const isSelected = question.settings.allow_multiple
              ? Array.isArray(value) && value.includes(option)
              : value === option

            return (
              <label
                key={idx}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'border-tamu-maroon bg-tamu-maroon/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type={question.settings.allow_multiple ? 'checkbox' : 'radio'}
                  name={`question-${question.id}`}
                  checked={isSelected}
                  onChange={() => {
                    if (question.settings.allow_multiple) {
                      const currentValues = Array.isArray(value) ? value : []
                      if (isSelected) {
                        onChange(currentValues.filter(v => v !== option))
                      } else {
                        onChange([...currentValues, option])
                      }
                    } else {
                      onChange(option)
                    }
                  }}
                  className="text-tamu-maroon focus:ring-tamu-maroon"
                />
                <span className="text-sm text-gray-700">{option}</span>
              </label>
            )
          })}
        </div>
      )}

      {error && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}
    </div>
  )
}

