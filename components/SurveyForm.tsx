'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

const CAREER_FIELDS = [
  'Engineering',
  'Business/Finance',
  'Medicine/Healthcare',
  'Law',
  'Education',
  'Arts/Design',
  'Technology/Computer Science',
  'Science/Research',
  'Agriculture',
  'Communication/Media',
  'Social Work',
  'Government/Public Service',
  'Sports/Fitness',
  'Hospitality/Tourism',
  'Other'
]

const CLASSIFICATIONS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate']

const RACES = [
  'White',
  'Black',
  'Hispanic',
  'Asian',
  'South Asian',
  'Pacific Islander',
  'Other/Multiple'
]

const SEXUALITIES = ['Straight', 'Gay', 'Lesbian', 'Other']

const GENDERS = ['Male', 'Female', 'Other']

const ACTIVITIES = [
  'Volunteering',
  'Social Events',
  'Projects',
  'Competitions',
  'Workshops',
  'Trips'
]

const RELIGIONS = ['Hindu', 'Christian', 'Muslim', 'Jewish', 'Buddhist', 'Other']

const ENGINEERING_TYPES = [
  'Aerospace engineering',
  'Architectural engineering',
  'Biological and agricultural engineering',
  'Biomedical engineering',
  'Chemical engineering',
  'Civil engineering',
  'Computer engineering',
  'Electrical engineering',
  'Environmental engineering',
  'Industrial engineering',
  'Interdisciplinary engineering',
  'Materials science and engineering',
  'Mechanical engineering',
  'Nuclear engineering',
  'Ocean engineering',
  'Petroleum engineering',
  'Engineering technology and related programs',
  'Electronic systems engineering technology',
  'Manufacturing and mechanical engineering technology',
  'Multidisciplinary engineering technology',
  'Industrial distribution',
  'Computer science'
]

interface SurveyData {
  name: string
  email: string
  careerFields: string[]
  engineeringTypes: string[]
  livesOnCampus: string
  hall: string
  classification: string
  race: string
  raceOther: string
  sexuality: string
  sexualityOther: string
  gender: string
  genderOther: string
  hobbies: string
  additionalHobbies: string[]
  activities: string[]
  interestedInReligiousOrgs: string
  religion: string
  religionOther: string
}

export default function SurveyForm() {
  const { user, signOut, session, loading: authLoading, userQuery, userQueryLoading, refreshUserQuery } = useAuth()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<SurveyData>({
    name: user?.user_metadata?.name || '',
    email: user?.email || '',
    careerFields: [],
    engineeringTypes: [],
    livesOnCampus: '',
    hall: '',
    classification: '',
    race: '',
    raceOther: '',
    sexuality: '',
    sexualityOther: '',
    gender: '',
    genderOther: '',
    hobbies: '',
    additionalHobbies: [],
    activities: [],
    interestedInReligiousOrgs: '',
    religion: '',
    religionOther: ''
  })
  const [additionalHobbyInput, setAdditionalHobbyInput] = useState('')
  const [engineeringTypeInput, setEngineeringTypeInput] = useState('')
  const [showEngineeringDropdown, setShowEngineeringDropdown] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [lastSubmissionTime, setLastSubmissionTime] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [hasExistingProfile, setHasExistingProfile] = useState(false)

  const steps = [
    'Contact Info',
    'Career Fields',
    'Housing',
    'Classification',
    'Demographics',
    'Activities'
  ]

  // Load user data from context
  useEffect(() => {
    if (authLoading || userQueryLoading) return

    if (!user) {
      setLoadingProfile(false)
      return
    }

    const savedDemographics = userQuery?.user_demographics as Record<string, unknown> | null

    if (savedDemographics && typeof savedDemographics === 'object') {
      setFormData(prev => ({
        ...prev,
        name: (savedDemographics.name as string) || user?.user_metadata?.name || prev.name || '',
        gender: (savedDemographics.gender as string) || prev.gender || '',
        genderOther: (savedDemographics.genderOther as string) || prev.genderOther || '',
        race: (savedDemographics.race as string) || prev.race || '',
        raceOther: (savedDemographics.raceOther as string) || prev.raceOther || '',
        classification: (savedDemographics.classification as string) || prev.classification || '',
        sexuality: (savedDemographics.sexuality as string) || prev.sexuality || '',
        sexualityOther: (savedDemographics.sexualityOther as string) || prev.sexualityOther || '',
        careerFields: Array.isArray(savedDemographics.careerFields) ? savedDemographics.careerFields : prev.careerFields || [],
        engineeringTypes: Array.isArray(savedDemographics.engineeringTypes) ? savedDemographics.engineeringTypes : prev.engineeringTypes || [],
        religion: (savedDemographics.religion as string) || prev.religion || '',
        religionOther: (savedDemographics.religionOther as string) || prev.religionOther || '',
        livesOnCampus: (savedDemographics.livesOnCampus as string) || prev.livesOnCampus || '',
        hall: (savedDemographics.hall as string) || prev.hall || '',
        activities: Array.isArray(savedDemographics.activities) ? savedDemographics.activities : prev.activities || [],
        interestedInReligiousOrgs: (savedDemographics.interestedInReligiousOrgs as string) || prev.interestedInReligiousOrgs || '',
        additionalHobbies: Array.isArray(savedDemographics.additionalHobbies) ? savedDemographics.additionalHobbies : prev.additionalHobbies || [],
        hobbies: (savedDemographics.hobbies as string) || prev.hobbies || ''
      }))
      setHasExistingProfile(true)
    }

    setLoadingProfile(false)
  }, [user, authLoading, userQueryLoading, userQuery])

  // Update name and email when user loads
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || user.user_metadata?.name || '',
        email: user.email || prev.email || ''
      }))
    }
  }, [user])

  const handleNext = () => {
    // Validation for each step
    if (currentStep === 0) {
      if (!formData.name.trim() || !formData.email.trim()) {
        alert('Please enter your name and email to continue.')
        return
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        alert('Please enter a valid email address.')
        return
      }
    } else if (currentStep === 1) {
      if (formData.careerFields.length === 0) {
        alert('Please select at least one career field to continue.')
        return
      }
      if (formData.careerFields.includes('Engineering') && formData.engineeringTypes.length === 0) {
        alert('Please select at least one type of engineering to continue.')
        return
      }
    } else if (currentStep === 2) {
      if (!formData.livesOnCampus) {
        alert('Please indicate whether you live on campus to continue.')
        return
      }
    } else if (currentStep === 3) {
      if (!formData.classification) {
        alert('Please select your classification to continue.')
        return
      }
    } else if (currentStep === 4) {
      if (formData.race === 'Other/Multiple' && !formData.raceOther.trim()) {
        alert('Please specify your race to continue.')
        return
      }
      if (formData.sexuality === 'Other' && !formData.sexualityOther.trim()) {
        alert('Please specify your sexuality to continue.')
        return
      }
      if (formData.gender === 'Other' && !formData.genderOther.trim()) {
        alert('Please specify your gender to continue.')
        return
      }
    }
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    // Final step validation
    if (formData.activities.length === 0) {
      alert('Please select at least one activity to continue.')
      return
    }
    if (!formData.interestedInReligiousOrgs) {
      alert('Please indicate whether you are interested in religious organizations to continue.')
      return
    }
    if (formData.interestedInReligiousOrgs === 'Yes' && !formData.religion) {
      alert('Please select your religion to continue.')
      return
    }
    if (formData.interestedInReligiousOrgs === 'Yes' && formData.religion === 'Other' && !formData.religionOther.trim()) {
      alert('Please specify your religion to continue.')
      return
    }

    // Honeypot check
    if (honeypot) return
    if (isSubmitting) return
    
    const now = Date.now()
    if (now - lastSubmissionTime < 3000) {
      alert('Please wait a moment before submitting again')
      return
    }
    
    setIsSubmitting(true)
    setLastSubmissionTime(now)
    
    try {
      // Build cleansed query string
      const cleansed: string[] = []
      
      if (formData.careerFields.length > 0) {
        const careerFieldsStr = formData.careerFields.join(', ')
        cleansed.push(careerFieldsStr, careerFieldsStr, careerFieldsStr)
      }
      
      if (formData.engineeringTypes.length > 0) {
        const engineeringTypesStr = formData.engineeringTypes.join(', ')
        cleansed.push(engineeringTypesStr, engineeringTypesStr)
      }
      
      if (formData.activities.length > 0) {
        const activitiesStr = formData.activities.join(', ')
        cleansed.push(activitiesStr, activitiesStr)
      }
      
      if (formData.hobbies) cleansed.push(formData.hobbies)
      if (formData.additionalHobbies.length > 0) cleansed.push(formData.additionalHobbies.join(', '))
      
      const campusStatus = formData.livesOnCampus === 'Yes' ? 'on-campus' : formData.livesOnCampus === 'No' ? 'off-campus' : ''
      if (campusStatus) cleansed.push(campusStatus)
      if (formData.livesOnCampus === 'Yes' && formData.hall) cleansed.push(formData.hall)
      
      if (formData.race) {
        cleansed.push(formData.race + (formData.raceOther ? ` (${formData.raceOther})` : ''))
      }
      
      if (formData.sexuality && formData.sexuality !== 'Straight') {
        cleansed.push(formData.sexuality === 'Other' ? formData.sexualityOther : formData.sexuality)
      }
      
      if (formData.gender) {
        cleansed.push(formData.gender === 'Other' ? formData.genderOther : formData.gender)
      }
      
      if (formData.interestedInReligiousOrgs === 'Yes' && formData.religion) {
        cleansed.push(formData.religion)
      }
      
      const finalCleansedString = cleansed.join(' | ')

      const token = session?.access_token
      if (!token) {
        alert('Please sign in to save your preferences.')
        return
      }

      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          query: finalCleansedString,
          cleansedQuery: finalCleansedString,
          gender: formData.gender,
          genderOther: formData.genderOther,
          race: formData.race,
          raceOther: formData.raceOther,
          classification: formData.classification,
          sexuality: formData.sexuality,
          sexualityOther: formData.sexualityOther,
          careerFields: formData.careerFields,
          engineeringTypes: formData.engineeringTypes,
          religion: formData.religion,
          religionOther: formData.religionOther,
          livesOnCampus: formData.livesOnCampus,
          hall: formData.hall,
          activities: formData.activities,
          interestedInReligiousOrgs: formData.interestedInReligiousOrgs,
          additionalHobbies: formData.additionalHobbies,
          hobbies: formData.hobbies,
          website: honeypot
        })
      })
      
      const data = await response.json()
      
      if (data.error) {
        console.error('Failed to save preferences:', data.error)
        alert('Failed to save your preferences. Please try again.')
      } else {
        console.log('Preferences saved successfully')
        // Refresh the userQuery in AuthContext before navigating
        // This ensures the explore page has the latest query
        await refreshUserQuery()
        router.push('/dashboard/explore')
      }
    } catch (err) {
      console.error('Failed to save preferences:', err)
      alert('Failed to save your preferences. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleCareerField = (field: string) => {
    setFormData(prev => {
      const newCareerFields = prev.careerFields.includes(field)
        ? prev.careerFields.filter(f => f !== field)
        : [...prev.careerFields, field]
      
      if (!newCareerFields.includes('Engineering')) {
        return { ...prev, careerFields: newCareerFields, engineeringTypes: [] }
      }
      return { ...prev, careerFields: newCareerFields }
    })
  }

  const toggleEngineeringType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      engineeringTypes: prev.engineeringTypes.includes(type)
        ? prev.engineeringTypes.filter(t => t !== type)
        : [...prev.engineeringTypes, type]
    }))
    setEngineeringTypeInput('')
    setShowEngineeringDropdown(false)
  }

  const filteredEngineeringTypes = ENGINEERING_TYPES.filter(type =>
    type.toLowerCase().includes(engineeringTypeInput.toLowerCase()) &&
    !formData.engineeringTypes.includes(type)
  )

  const toggleActivity = (activity: string) => {
    setFormData(prev => ({
      ...prev,
      activities: prev.activities.includes(activity)
        ? prev.activities.filter(a => a !== activity)
        : [...prev.activities, activity]
    }))
  }

  if (loadingProfile || authLoading || userQueryLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 py-4 sm:py-8 md:py-12 px-3 sm:px-4 md:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex-1 flex justify-start gap-2">
              {user && (
                <Link href="/dashboard">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-tamu-maroon border border-tamu-maroon rounded-lg font-medium hover:bg-tamu-maroon hover:text-white transition-all"
                  >
                    Dashboard
                  </motion.button>
                </Link>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4 flex-1">
              <Image 
                src="/logo.png" 
                alt="ORGanize TAMU Logo" 
                width={112}
                height={112}
                className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 flex-shrink-0 object-contain"
              />
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-tamu-maroon">
                ORGanize TAMU
              </h1>
            </div>
            <div className="flex-1 flex justify-end">
              {user && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={signOut}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-all"
                >
                  Sign Out
                </motion.button>
              )}
            </div>
          </div>
          <p className="text-gray-600 text-sm sm:text-base md:text-lg mb-2 px-2">
            {hasExistingProfile ? 'Update your preferences to refine your organization matches' : 'Complete your profile to find your perfect organization match'}
          </p>
          <div className="w-24 h-1 bg-tamu-maroon mx-auto"></div>
        </motion.div>

        {/* Progress Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm font-semibold text-tamu-maroon">
              {steps[currentStep]}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              className="bg-tamu-maroon h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>

        {/* Form Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8 mb-4 sm:mb-6"
          >
            {/* Step 0: Contact Info */}
            {currentStep === 0 && (
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-tamu-maroon mb-4 sm:mb-6">
                  Let&apos;s get started!
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 font-medium mb-1 sm:mb-2 text-sm sm:text-base">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full p-2.5 sm:p-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                      placeholder="Enter your name"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-1 sm:mb-2 text-sm sm:text-base">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={user?.email || formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full p-2.5 sm:p-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none bg-gray-50"
                      placeholder={user?.email || "Enter your email"}
                      disabled={!!user?.email}
                      readOnly={!!user?.email}
                    />
                    {user?.email && (
                      <p className="text-xs text-gray-500 mt-1">Using your account email</p>
                    )}
                  </div>
                  <input
                    type="text"
                    name="website"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                  />
                </div>
              </div>
            )}

            {/* Step 1: Career Fields */}
            {currentStep === 1 && (
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-tamu-maroon mb-4 sm:mb-6">
                  Which career fields are you interested in? *
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {CAREER_FIELDS.map((field) => (
                    <motion.button
                      key={field}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleCareerField(field)}
                      className={`p-3 sm:p-4 rounded-lg border-2 text-left text-sm sm:text-base transition-all ${
                        formData.careerFields.includes(field)
                          ? 'border-tamu-maroon bg-tamu-maroon text-white'
                          : 'border-gray-300 hover:border-tamu-maroon-light'
                      }`}
                    >
                      {field}
                    </motion.button>
                  ))}
                </div>
                
                {formData.careerFields.includes('Engineering') && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200"
                  >
                    <h3 className="text-lg sm:text-xl font-semibold text-tamu-maroon mb-3 sm:mb-4">
                      Which types of engineering? *
                    </h3>
                    <div className="relative">
                      <input
                        type="text"
                        value={engineeringTypeInput}
                        onChange={(e) => {
                          setEngineeringTypeInput(e.target.value)
                          setShowEngineeringDropdown(true)
                        }}
                        onFocus={() => setShowEngineeringDropdown(true)}
                        onBlur={() => setTimeout(() => setShowEngineeringDropdown(false), 200)}
                        placeholder="Search engineering types..."
                        className="w-full p-2.5 sm:p-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                      />
                      {showEngineeringDropdown && filteredEngineeringTypes.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredEngineeringTypes.map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => toggleEngineeringType(type)}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-tamu-maroon-light hover:text-white transition-colors"
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {formData.engineeringTypes.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {formData.engineeringTypes.map((type) => (
                          <span
                            key={type}
                            className="flex items-center gap-2 px-3 py-1 rounded-full bg-tamu-maroon text-white text-sm"
                          >
                            {type}
                            <button onClick={() => toggleEngineeringType(type)} className="ml-1 text-xs font-bold">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            )}

            {/* Step 2: Housing */}
            {currentStep === 2 && (
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-tamu-maroon mb-4 sm:mb-6">
                  Do you live on campus? *
                </h2>
                <div className="flex gap-2 sm:gap-4">
                  {['Yes', 'No'].map((option) => (
                    <motion.button
                      key={option}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setFormData(prev => ({ ...prev, livesOnCampus: option }))}
                      className={`flex-1 p-3 sm:p-4 rounded-lg border-2 text-sm sm:text-base font-semibold transition-all ${
                        formData.livesOnCampus === option
                          ? 'border-tamu-maroon bg-tamu-maroon text-white'
                          : 'border-gray-300 hover:border-tamu-maroon-light'
                      }`}
                    >
                      {option}
                    </motion.button>
                  ))}
                </div>
                {formData.livesOnCampus === 'Yes' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4">
                    <label className="block text-gray-700 font-medium mb-2">What hall?</label>
                    <input
                      type="text"
                      value={formData.hall}
                      onChange={(e) => setFormData(prev => ({ ...prev, hall: e.target.value }))}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                      placeholder="Enter hall name"
                    />
                  </motion.div>
                )}
              </div>
            )}

            {/* Step 3: Classification */}
            {currentStep === 3 && (
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-tamu-maroon mb-4 sm:mb-6">
                  What classification are you? *
                </h2>
                <div className="space-y-2 sm:space-y-3">
                  {CLASSIFICATIONS.map((classification) => (
                    <motion.button
                      key={classification}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setFormData(prev => ({ ...prev, classification }))}
                      className={`w-full p-3 sm:p-4 rounded-lg border-2 text-left text-sm sm:text-base transition-all ${
                        formData.classification === classification
                          ? 'border-tamu-maroon bg-tamu-maroon text-white'
                          : 'border-gray-300 hover:border-tamu-maroon-light'
                      }`}
                    >
                      {classification}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Demographics */}
            {currentStep === 4 && (
              <div className="space-y-8">
                {/* Race */}
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-tamu-maroon mb-3">What&apos;s your race?</h3>
                  <div className="space-y-2">
                    {RACES.map((race) => (
                      <motion.button
                        key={race}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setFormData(prev => ({ ...prev, race }))}
                        className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                          formData.race === race ? 'border-tamu-maroon bg-tamu-maroon text-white' : 'border-gray-300 hover:border-tamu-maroon-light'
                        }`}
                      >
                        {race}
                      </motion.button>
                    ))}
                  </div>
                  {formData.race === 'Other/Multiple' && (
                    <input
                      type="text"
                      value={formData.raceOther}
                      onChange={(e) => setFormData(prev => ({ ...prev, raceOther: e.target.value }))}
                      className="mt-3 w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                      placeholder="Please specify"
                    />
                  )}
                </div>

                {/* Sexuality */}
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-tamu-maroon mb-3">What&apos;s your sexuality?</h3>
                  <div className="space-y-2">
                    {SEXUALITIES.map((sexuality) => (
                      <motion.button
                        key={sexuality}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setFormData(prev => ({ ...prev, sexuality }))}
                        className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                          formData.sexuality === sexuality ? 'border-tamu-maroon bg-tamu-maroon text-white' : 'border-gray-300 hover:border-tamu-maroon-light'
                        }`}
                      >
                        {sexuality}
                      </motion.button>
                    ))}
                  </div>
                  {formData.sexuality === 'Other' && (
                    <input
                      type="text"
                      value={formData.sexualityOther}
                      onChange={(e) => setFormData(prev => ({ ...prev, sexualityOther: e.target.value }))}
                      className="mt-3 w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                      placeholder="Please specify"
                    />
                  )}
                </div>

                {/* Gender */}
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-tamu-maroon mb-3">What&apos;s your gender?</h3>
                  <div className="space-y-2">
                    {GENDERS.map((gender) => (
                      <motion.button
                        key={gender}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setFormData(prev => ({ ...prev, gender }))}
                        className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                          formData.gender === gender ? 'border-tamu-maroon bg-tamu-maroon text-white' : 'border-gray-300 hover:border-tamu-maroon-light'
                        }`}
                      >
                        {gender}
                      </motion.button>
                    ))}
                  </div>
                  {formData.gender === 'Other' && (
                    <input
                      type="text"
                      value={formData.genderOther}
                      onChange={(e) => setFormData(prev => ({ ...prev, genderOther: e.target.value }))}
                      className="mt-3 w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                      placeholder="Please specify"
                    />
                  )}
                </div>

                {/* Hobbies */}
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-tamu-maroon mb-3">Tell us about your hobbies</h3>
                  <input
                    type="text"
                    value={additionalHobbyInput}
                    onChange={(e) => setAdditionalHobbyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const value = additionalHobbyInput.trim()
                        if (value && !formData.additionalHobbies.includes(value)) {
                          setFormData(prev => ({ ...prev, additionalHobbies: [...prev.additionalHobbies, value] }))
                          setAdditionalHobbyInput('')
                        }
                      }
                    }}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                    placeholder="Type a hobby and press Enter"
                  />
                  {formData.additionalHobbies.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {formData.additionalHobbies.map((hobby) => (
                        <span key={hobby} className="flex items-center gap-2 px-3 py-1 rounded-full bg-tamu-maroon text-white text-sm">
                          {hobby}
                          <button onClick={() => setFormData(prev => ({ ...prev, additionalHobbies: prev.additionalHobbies.filter(h => h !== hobby) }))} className="ml-1 text-xs font-bold">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 5: Activities & Religious Orgs */}
            {currentStep === 5 && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-tamu-maroon mb-3">Which activities sound appealing? *</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {ACTIVITIES.map((activity) => (
                      <motion.button
                        key={activity}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleActivity(activity)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          formData.activities.includes(activity)
                            ? 'border-tamu-maroon bg-tamu-maroon text-white'
                            : 'border-gray-300 hover:border-tamu-maroon-light'
                        }`}
                      >
                        {activity}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-tamu-maroon mb-3">Interested in religious organizations? *</h3>
                  <div className="flex gap-4 mb-4">
                    {['Yes', 'No'].map((option) => (
                      <motion.button
                        key={option}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setFormData(prev => ({ ...prev, interestedInReligiousOrgs: option, religion: option === 'No' ? '' : prev.religion }))}
                        className={`flex-1 p-3 rounded-lg border-2 font-semibold transition-all ${
                          formData.interestedInReligiousOrgs === option
                            ? 'border-tamu-maroon bg-tamu-maroon text-white'
                            : 'border-gray-300 hover:border-tamu-maroon-light'
                        }`}
                      >
                        {option}
                      </motion.button>
                    ))}
                  </div>
                  {formData.interestedInReligiousOrgs === 'Yes' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <h4 className="text-base font-medium text-gray-700 mb-2">What is your religion? *</h4>
                      <div className="space-y-2">
                        {RELIGIONS.map((religion) => (
                          <motion.button
                            key={religion}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setFormData(prev => ({ ...prev, religion, religionOther: religion === 'Other' ? prev.religionOther : '' }))}
                            className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                              formData.religion === religion ? 'border-tamu-maroon bg-tamu-maroon text-white' : 'border-gray-300 hover:border-tamu-maroon-light'
                            }`}
                          >
                            {religion}
                          </motion.button>
                        ))}
                      </div>
                      {formData.religion === 'Other' && (
                        <input
                          type="text"
                          value={formData.religionOther}
                          onChange={(e) => setFormData(prev => ({ ...prev, religionOther: e.target.value }))}
                          className="mt-3 w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                          placeholder="Please specify your religion"
                        />
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBack}
                disabled={currentStep === 0}
                className={`px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base rounded-lg font-semibold transition-all ${
                  currentStep === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Back
              </motion.button>
              {currentStep < steps.length - 1 ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleNext}
                  className="px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light transition-all"
                >
                  Next
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={`px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light transition-all ${
                    isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmitting ? 'Saving...' : (hasExistingProfile ? 'Update & View Recommendations' : 'Find My Organizations')}
                </motion.button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
