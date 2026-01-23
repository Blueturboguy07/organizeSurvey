'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

interface FormQuestion {
  id: string
  form_id: string
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
  organization_id: string
  title: string
  description: string | null
  is_active: boolean
}

interface FormBuilderProps {
  organizationId: string
}

const QUESTION_TYPES = [
  { value: 'short_text', label: 'Short Text', icon: '📝', description: 'Single line answer' },
  { value: 'long_text', label: 'Long Text', icon: '📄', description: 'Multi-line answer with word limit' },
  { value: 'multiple_choice', label: 'Multiple Choice', icon: '☑️', description: 'Select from options' },
  { value: 'file_upload', label: 'File Upload', icon: '📎', description: 'PDF file upload' },
] as const

export default function FormBuilder({ organizationId }: FormBuilderProps) {
  const supabase = createClientComponentClient()
  
  const [form, setForm] = useState<OrgForm | null>(null)
  const [questions, setQuestions] = useState<FormQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Editing states
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  
  // New question form
  const [newQuestion, setNewQuestion] = useState({
    question_text: '',
    question_type: 'short_text' as FormQuestion['question_type'],
    is_required: true,
    settings: {} as FormQuestion['settings']
  })

  // Fetch form and questions
  const fetchForm = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Check if form exists for this org
      let { data: formData, error: formError } = await supabase
        .from('org_forms')
        .select('*')
        .eq('organization_id', organizationId)
        .single()
      
      if (formError && formError.code === 'PGRST116') {
        // No form exists, create one
        const { data: newForm, error: createError } = await supabase
          .from('org_forms')
          .insert({
            organization_id: organizationId,
            title: 'Application Form',
            description: 'Tell us about yourself',
            is_active: true
          })
          .select()
          .single()
        
        if (createError) {
          setError('Failed to create form')
          setLoading(false)
          return
        }
        
        formData = newForm
      } else if (formError) {
        setError('Failed to load form')
        setLoading(false)
        return
      }
      
      setForm(formData)
      
      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('form_questions')
        .select('*')
        .eq('form_id', formData.id)
        .order('order_index', { ascending: true })
      
      if (questionsError) {
        console.error('Error fetching questions:', questionsError)
      } else {
        setQuestions(questionsData || [])
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Failed to load form')
    } finally {
      setLoading(false)
    }
  }, [organizationId, supabase])

  useEffect(() => {
    fetchForm()
  }, [fetchForm])

  // Realtime subscription for questions
  const channelRef = useRef<RealtimeChannel | null>(null)
  
  useEffect(() => {
    if (!form) return
    
    // Subscribe to realtime changes on form_questions
    const channel = supabase
      .channel(`form_questions_${form.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'form_questions',
          filter: `form_id=eq.${form.id}`
        },
        (payload) => {
          console.log('📝 Form questions realtime event:', payload.eventType)
          
          if (payload.eventType === 'INSERT') {
            const newQ = payload.new as FormQuestion
            setQuestions(prev => {
              // Avoid duplicates
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

  // Add new question
  const handleAddQuestion = async () => {
    if (!form || !newQuestion.question_text.trim()) {
      setError('Question text is required')
      return
    }
    
    setSaving(true)
    setError(null)
    
    try {
      const { data, error } = await supabase
        .from('form_questions')
        .insert({
          form_id: form.id,
          question_text: newQuestion.question_text.trim(),
          question_type: newQuestion.question_type,
          is_required: newQuestion.is_required,
          order_index: questions.length,
          settings: newQuestion.settings
        })
        .select()
        .single()
      
      if (error) throw error
      
      // Realtime will add the question to state
      setNewQuestion({
        question_text: '',
        question_type: 'short_text',
        is_required: true,
        settings: {}
      })
      setShowAddQuestion(false)
      setSuccess('Question added!')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to add question')
    } finally {
      setSaving(false)
    }
  }

  // Update question
  const handleUpdateQuestion = async (questionId: string, updates: Partial<FormQuestion>) => {
    setSaving(true)
    setError(null)
    
    try {
      const { error } = await supabase
        .from('form_questions')
        .update(updates)
        .eq('id', questionId)
      
      if (error) throw error
      
      // Realtime will update the question in state
      setEditingQuestionId(null)
      setSuccess('Question updated!')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to update question')
    } finally {
      setSaving(false)
    }
  }

  // Delete question
  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return
    
    setSaving(true)
    setError(null)
    
    try {
      const { error } = await supabase
        .from('form_questions')
        .delete()
        .eq('id', questionId)
      
      if (error) throw error
      
      // Realtime will remove the question from state
      setSuccess('Question deleted!')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to delete question')
    } finally {
      setSaving(false)
    }
  }

  // Move question up/down
  const handleMoveQuestion = async (questionId: string, direction: 'up' | 'down') => {
    const currentIndex = questions.findIndex(q => q.id === questionId)
    if (currentIndex === -1) return
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= questions.length) return
    
    const newQuestions = [...questions]
    const [movedQuestion] = newQuestions.splice(currentIndex, 1)
    newQuestions.splice(newIndex, 0, movedQuestion)
    
    // Update order indices
    const updates = newQuestions.map((q, idx) => ({
      id: q.id,
      order_index: idx
    }))
    
    setQuestions(newQuestions.map((q, idx) => ({ ...q, order_index: idx })))
    
    // Persist to database
    for (const update of updates) {
      await supabase
        .from('form_questions')
        .update({ order_index: update.order_index })
        .eq('id', update.id)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tamu-maroon"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Application Form Builder</h3>
          <p className="text-sm text-gray-500">
            {questions.length} question{questions.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!showAddQuestion && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddQuestion(true)}
            className="px-4 py-2 bg-tamu-maroon text-white rounded-lg font-medium text-sm hover:bg-tamu-maroon-light transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Question
          </motion.button>
        )}
      </div>

      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600"
          >
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600"
          >
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Questions List */}
      <div className="space-y-3">
        <AnimatePresence>
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              question={question}
              index={index}
              isFirst={index === 0}
              isLast={index === questions.length - 1}
              isEditing={editingQuestionId === question.id}
              onEdit={() => setEditingQuestionId(question.id)}
              onCancelEdit={() => setEditingQuestionId(null)}
              onSave={(updates) => handleUpdateQuestion(question.id, updates)}
              onDelete={() => handleDeleteQuestion(question.id)}
              onMoveUp={() => handleMoveQuestion(question.id, 'up')}
              onMoveDown={() => handleMoveQuestion(question.id, 'down')}
              saving={saving}
            />
          ))}
        </AnimatePresence>

        {questions.length === 0 && !showAddQuestion && (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-2">No questions yet</p>
            <p className="text-sm">Click &quot;Add Question&quot; to start building your form</p>
          </div>
        )}
      </div>

      {/* Add Question Form */}
      <AnimatePresence>
        {showAddQuestion && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-4"
          >
            <h4 className="font-medium text-gray-800 mb-4">Add New Question</h4>
            
            {/* Question Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
              <div className="grid grid-cols-3 gap-2">
                {QUESTION_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => {
                      setNewQuestion({
                        ...newQuestion,
                        question_type: type.value as FormQuestion['question_type'],
                        settings: type.value === 'long_text' 
                          ? { word_limit: 500 } 
                          : type.value === 'multiple_choice'
                            ? { options: ['Option 1', 'Option 2'], allow_multiple: false }
                            : type.value === 'file_upload'
                              ? { accepted_types: ['application/pdf'], max_size_mb: 10 }
                              : {}
                      })
                    }}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      newQuestion.question_type === type.value
                        ? 'border-tamu-maroon bg-tamu-maroon/5 ring-2 ring-tamu-maroon/20'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="text-lg mb-1">{type.icon}</div>
                    <div className="text-sm font-medium">{type.label}</div>
                    <div className="text-xs text-gray-500">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Question Text */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
              <input
                type="text"
                value={newQuestion.question_text}
                onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                placeholder="Enter your question..."
                className="w-full p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-1 focus:ring-tamu-maroon"
              />
            </div>

            {/* Type-specific settings */}
            {newQuestion.question_type === 'long_text' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Word Limit</label>
                <input
                  type="number"
                  value={newQuestion.settings.word_limit || 500}
                  onChange={(e) => setNewQuestion({
                    ...newQuestion,
                    settings: { ...newQuestion.settings, word_limit: parseInt(e.target.value) || 500 }
                  })}
                  min="10"
                  max="5000"
                  className="w-32 p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                />
              </div>
            )}

            {newQuestion.question_type === 'multiple_choice' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                <div className="space-y-2">
                  {(newQuestion.settings.options || []).map((option, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...(newQuestion.settings.options || [])]
                          newOptions[idx] = e.target.value
                          setNewQuestion({
                            ...newQuestion,
                            settings: { ...newQuestion.settings, options: newOptions }
                          })
                        }}
                        placeholder={`Option ${idx + 1}`}
                        className="flex-1 p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                      />
                      {(newQuestion.settings.options || []).length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newOptions = (newQuestion.settings.options || []).filter((_, i) => i !== idx)
                            setNewQuestion({
                              ...newQuestion,
                              settings: { ...newQuestion.settings, options: newOptions }
                            })
                          }}
                          className="px-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const newOptions = [...(newQuestion.settings.options || []), `Option ${(newQuestion.settings.options || []).length + 1}`]
                      setNewQuestion({
                        ...newQuestion,
                        settings: { ...newQuestion.settings, options: newOptions }
                      })
                    }}
                    className="text-sm text-tamu-maroon hover:underline"
                  >
                    + Add Option
                  </button>
                </div>
                
                <label className="flex items-center gap-2 mt-3">
                  <input
                    type="checkbox"
                    checked={newQuestion.settings.allow_multiple || false}
                    onChange={(e) => setNewQuestion({
                      ...newQuestion,
                      settings: { ...newQuestion.settings, allow_multiple: e.target.checked }
                    })}
                    className="rounded border-gray-300 text-tamu-maroon focus:ring-tamu-maroon"
                  />
                  <span className="text-sm text-gray-700">Allow multiple selections</span>
                </label>
              </div>
            )}

            {newQuestion.question_type === 'file_upload' && (
              <div className="mb-4">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-700">
                    <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">PDF files only</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Max file size: 10 MB</p>
                </div>
              </div>
            )}

            {/* Required toggle */}
            <div className="mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newQuestion.is_required}
                  onChange={(e) => setNewQuestion({ ...newQuestion, is_required: e.target.checked })}
                  className="rounded border-gray-300 text-tamu-maroon focus:ring-tamu-maroon"
                />
                <span className="text-sm text-gray-700">Required question</span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleAddQuestion}
                disabled={saving || !newQuestion.question_text.trim()}
                className="px-4 py-2 bg-tamu-maroon text-white rounded-lg font-medium text-sm hover:bg-tamu-maroon-light transition-colors disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add Question'}
              </button>
              <button
                onClick={() => {
                  setShowAddQuestion(false)
                  setNewQuestion({
                    question_text: '',
                    question_type: 'short_text',
                    is_required: true,
                    settings: {}
                  })
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Question Card Component
function QuestionCard({
  question,
  index,
  isFirst,
  isLast,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
  saving
}: {
  question: FormQuestion
  index: number
  isFirst: boolean
  isLast: boolean
  isEditing: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onSave: (updates: Partial<FormQuestion>) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  saving: boolean
}) {
  const [editData, setEditData] = useState({
    question_text: question.question_text,
    is_required: question.is_required,
    settings: question.settings
  })

  useEffect(() => {
    setEditData({
      question_text: question.question_text,
      is_required: question.is_required,
      settings: question.settings
    })
  }, [question])

  const typeConfig = QUESTION_TYPES.find(t => t.value === question.question_type)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white border border-gray-200 rounded-lg p-4"
    >
      {isEditing ? (
        // Edit mode
        <div className="space-y-3">
          <input
            type="text"
            value={editData.question_text}
            onChange={(e) => setEditData({ ...editData, question_text: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
          />
          
          {question.question_type === 'long_text' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Word limit:</span>
              <input
                type="number"
                value={editData.settings.word_limit || 500}
                onChange={(e) => setEditData({
                  ...editData,
                  settings: { ...editData.settings, word_limit: parseInt(e.target.value) || 500 }
                })}
                className="w-24 p-1 border border-gray-300 rounded text-sm"
              />
            </div>
          )}

          {question.question_type === 'multiple_choice' && (
            <div className="space-y-2">
              {(editData.settings.options || []).map((option, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...(editData.settings.options || [])]
                      newOptions[idx] = e.target.value
                      setEditData({
                        ...editData,
                        settings: { ...editData.settings, options: newOptions }
                      })
                    }}
                    className="flex-1 p-1 border border-gray-300 rounded text-sm"
                  />
                  {(editData.settings.options || []).length > 2 && (
                    <button
                      onClick={() => {
                        const newOptions = (editData.settings.options || []).filter((_, i) => i !== idx)
                        setEditData({
                          ...editData,
                          settings: { ...editData.settings, options: newOptions }
                        })
                      }}
                      className="text-red-500 text-sm"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => {
                  const newOptions = [...(editData.settings.options || []), 'New option']
                  setEditData({
                    ...editData,
                    settings: { ...editData.settings, options: newOptions }
                  })
                }}
                className="text-sm text-tamu-maroon hover:underline"
              >
                + Add Option
              </button>
            </div>
          )}
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editData.is_required}
              onChange={(e) => setEditData({ ...editData, is_required: e.target.checked })}
              className="rounded border-gray-300 text-tamu-maroon focus:ring-tamu-maroon"
            />
            <span className="text-sm text-gray-700">Required</span>
          </label>
          
          <div className="flex gap-2">
            <button
              onClick={() => onSave(editData)}
              disabled={saving}
              className="px-3 py-1 bg-tamu-maroon text-white rounded text-sm hover:bg-tamu-maroon-light disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={onCancelEdit}
              className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        // View mode
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-400 text-sm font-medium">{index + 1}.</span>
              <span className="text-sm">{typeConfig?.icon}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                question.is_required 
                  ? 'bg-red-100 text-red-600' 
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {question.is_required ? 'Required' : 'Optional'}
              </span>
            </div>
            <p className="text-gray-800 font-medium">{question.question_text}</p>
            
            {question.question_type === 'long_text' && question.settings.word_limit && (
              <p className="text-xs text-gray-500 mt-1">Max {question.settings.word_limit} words</p>
            )}
            
            {question.question_type === 'multiple_choice' && question.settings.options && (
              <div className="flex flex-wrap gap-1 mt-2">
                {question.settings.options.map((opt, idx) => (
                  <span key={idx} className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                    {opt}
                  </span>
                ))}
              </div>
            )}
            
            {question.question_type === 'file_upload' && (
              <p className="text-xs text-gray-500 mt-1">PDF upload (max 10 MB)</p>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {/* Move buttons */}
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move up"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move down"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Edit/Delete */}
            <button
              onClick={onEdit}
              className="p-1.5 text-gray-400 hover:text-tamu-maroon hover:bg-gray-100 rounded"
              title="Edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

