'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { RealtimeChannel } from '@supabase/supabase-js'

interface FormQuestion {
  id: string
  question_text: string
  question_type: 'short_text' | 'long_text' | 'multiple_choice' | 'file_upload'
  is_required: boolean
  order_index: number
  settings: {
    word_limit?: number
    options?: string[]
    allow_multiple?: boolean
    accepted_types?: string[]
    max_size_mb?: number
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
  const [fileUploads, setFileUploads] = useState<Record<string, File | null>>({})
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({})
  
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
      const file = fileUploads[question.id]
      
      if (question.is_required) {
        if (question.question_type === 'file_upload') {
          // For file uploads, check if file is selected or already uploaded (response has URL)
          if (!file && (!response || (typeof response === 'string' && !response.trim()))) {
            errors[question.id] = 'Please upload a file'
            continue
          }
        } else if (!response || (typeof response === 'string' && !response.trim()) || (Array.isArray(response) && response.length === 0)) {
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
      
      // Validate file type and size
      if (question.question_type === 'file_upload' && file) {
        const maxSize = (question.settings.max_size_mb || 10) * 1024 * 1024
        if (file.size > maxSize) {
          errors[question.id] = `File size must be less than ${question.settings.max_size_mb || 10} MB`
        }
        if (file.type !== 'application/pdf') {
          errors[question.id] = 'Only PDF files are allowed'
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

  // Upload file to Supabase storage
  const uploadFile = async (questionId: string, file: File): Promise<string | null> => {
    if (!user) return null
    
    setUploadingFiles(prev => ({ ...prev, [questionId]: true }))
    
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${questionId}_${Date.now()}.${fileExt}`
      
      const { data, error } = await supabase.storage
        .from('application-files')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })
      
      if (error) {
        console.error('File upload error:', error)
        setValidationErrors(prev => ({ ...prev, [questionId]: 'Failed to upload file' }))
        return null
      }
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('application-files')
        .getPublicUrl(fileName)
      
      return fileName // Store the path, not the public URL (for signed URLs later)
    } catch (err) {
      console.error('Upload error:', err)
      return null
    } finally {
      setUploadingFiles(prev => ({ ...prev, [questionId]: false }))
    }
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    // Upload any pending files first
    const finalResponses = { ...responses }
    const fileQuestions = questions.filter(q => q.question_type === 'file_upload')
    
    for (const question of fileQuestions) {
      const file = fileUploads[question.id]
      if (file) {
        const filePath = await uploadFile(question.id, file)
        if (filePath) {
          finalResponses[question.id] = filePath
        } else {
          // Upload failed, don't submit
          return
        }
      }
    }
    
    // Get the "why join" text - either from custom questions or default
    let whyJoin = ''
    if (questions.length > 0) {
      // Use first long_text question as "why join" or concatenate all responses
      const longTextQ = questions.find(q => q.question_type === 'long_text')
      if (longTextQ && finalResponses[longTextQ.id]) {
        whyJoin = finalResponses[longTextQ.id] as string
      } else {
        // Just use first non-file response
        const firstResponse = Object.entries(finalResponses).find(([key]) => {
          const q = questions.find(q => q.id === key)
          return q && q.question_type !== 'file_upload'
        })?.[1]
        whyJoin = typeof firstResponse === 'string' ? firstResponse : ''
      }
    } else {
      whyJoin = finalResponses['default_why_join'] as string || ''
    }
    
    await onSubmit({
      name: applicantName.trim(),
      email: applicantEmail.trim(),
      whyJoin,
      customResponses: finalResponses
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
            file={fileUploads[question.id]}
            onFileChange={(file) => setFileUploads(prev => ({ ...prev, [question.id]: file }))}
            isUploading={uploadingFiles[question.id]}
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
  error,
  file,
  onFileChange,
  isUploading
}: {
  question: FormQuestion
  index: number
  value: string | string[] | undefined
  onChange: (value: string | string[]) => void
  error?: string
  file?: File | null
  onFileChange?: (file: File | null) => void
  isUploading?: boolean
}) {
  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
  }

  const wordCount = question.question_type === 'long_text' && typeof value === 'string' 
    ? countWords(value) 
    : 0

  const isOverLimit = question.settings.word_limit && wordCount > question.settings.word_limit

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && onFileChange) {
      onFileChange(selectedFile)
    }
  }

  const handleRemoveFile = () => {
    if (onFileChange) {
      onFileChange(null)
    }
    // Clear the response if it was previously uploaded
    if (value) {
      onChange('')
    }
  }

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

      {question.question_type === 'file_upload' && (
        <div className="mt-2">
          {file || (value && typeof value === 'string' && value.includes('/')) ? (
            // File selected or already uploaded
            <div className={`flex items-center justify-between p-3 border rounded-lg ${
              error ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'
            }`}>
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {file ? file.name : 'File uploaded'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'PDF document'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            // No file selected - iOS-friendly file input
            <div className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg transition-all ${
              error 
                ? 'border-red-300 bg-red-50' 
                : 'border-gray-300 bg-gray-50 active:border-tamu-maroon active:bg-tamu-maroon/5'
            }`}>
              {/* Visible file input for iOS compatibility - positioned to cover the entire area */}
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                style={{ fontSize: '16px' }} // Prevents iOS zoom on focus
              />
              {isUploading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-tamu-maroon border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-600">Uploading...</span>
                </div>
              ) : (
                <>
                  <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm font-medium text-gray-600">Tap to upload PDF</p>
                  <p className="text-xs text-gray-500 mt-1">Max {question.settings.max_size_mb || 10} MB</p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}
    </div>
  )
}

