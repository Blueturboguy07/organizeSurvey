'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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

const PRIMARY_GOALS = [
  'Building my resume / Career help',
  'Making friends / Having fun',
  'Volunteering / Giving back',
  'Playing sports / Being active'
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
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<SurveyData>({
    name: '',
    email: '',
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
  const [submissionStats, setSubmissionStats] = useState<{
    totalSubmissions: number
    uniqueUsers: number
  } | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [resultsString, setResultsString] = useState('')
  const [cleansedString, setCleansedString] = useState('')
  const [additionalHobbyInput, setAdditionalHobbyInput] = useState('')
  const [engineeringTypeInput, setEngineeringTypeInput] = useState('')
  const [showEngineeringDropdown, setShowEngineeringDropdown] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [lastSubmissionTime, setLastSubmissionTime] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [allSearchResults, setAllSearchResults] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<string>('')
  const [showInsights, setShowInsights] = useState(false)
  const [queryKeywords, setQueryKeywords] = useState<string[]>([])
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null)

  const steps = [
    'Contact Info',
    'Career Fields',
    'Housing',
    'Classification',
    'Demographics',
    'Activities',
    'Results'
  ]

  const handleNext = () => {
    // Validate required fields for each step
    if (currentStep === 0) {
      // Step 0: Contact Info
      if (!formData.name.trim() || !formData.email.trim()) {
        alert('Please enter your name and email to continue.')
        return
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        alert('Please enter a valid email address.')
        return
      }
    } else if (currentStep === 1) {
      // Step 1: Career Fields
      if (formData.careerFields.length === 0) {
        alert('Please select at least one career field to continue.')
        return
      }
      if (formData.careerFields.includes('Engineering') && formData.engineeringTypes.length === 0) {
        alert('Please select at least one type of engineering to continue.')
        return
      }
    } else if (currentStep === 2) {
      // Step 2: Housing
      if (!formData.livesOnCampus) {
        alert('Please indicate whether you live on campus to continue.')
        return
      }
    } else if (currentStep === 3) {
      // Step 3: Classification
      if (!formData.classification) {
        alert('Please select your classification to continue.')
        return
      }
    } else if (currentStep === 4) {
      // Step 4: Demographics
      // Race, sexuality, and gender are optional, but if "Other" is selected, specification is required
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
      // Hobbies are optional - skip validation
    } else if (currentStep === 5) {
      // Step 5: Activities & Religious Orgs
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
    // Honeypot check - if filled, it's a bot
    if (honeypot) {
      return // Silently fail
    }
    
    // Prevent double submission
    if (isSubmitting) return
    
    // Throttle: minimum 3 seconds between submissions
    const now = Date.now()
    if (now - lastSubmissionTime < 3000) {
      alert('Please wait a moment before submitting again')
      return
    }
    
    setIsSubmitting(true)
    setLastSubmissionTime(now)
    
    try {
    // Original detailed version
    const results: string[] = []
    
    results.push(`Career Fields of Interest: ${formData.careerFields.join(', ') || 'Not specified'}`)
    results.push(`Lives on Campus: ${formData.livesOnCampus || 'Not specified'}`)
    if (formData.livesOnCampus === 'Yes' && formData.hall) {
      results.push(`Hall: ${formData.hall}`)
    }
    results.push(`Classification: ${formData.classification || 'Not specified'}`)
    results.push(`Race: ${formData.race}${formData.raceOther ? ` (${formData.raceOther})` : ''}`)
    results.push(`Sexuality: ${formData.sexuality}${formData.sexualityOther ? ` (${formData.sexualityOther})` : ''}`)
    results.push(`Gender: ${formData.gender}${formData.genderOther ? ` (${formData.genderOther})` : ''}`)
    results.push(`Hobbies: ${formData.hobbies || 'Not specified'}`)
    if (formData.additionalHobbies.length > 0) {
      results.push(`Additional Hobbies: ${formData.additionalHobbies.join(', ')}`)
    }
    results.push(`Activities of Interest: ${formData.activities.join(', ') || 'Not specified'}`)
    if (formData.interestedInReligiousOrgs === 'Yes') {
      results.push(`Religion: ${formData.religion || 'Not specified'}`)
    }
    
    const finalString = results.join(' | ')
    setResultsString(finalString)
    
    // Cleansed version - weighted to emphasize career and goals
    const cleansed: string[] = []
    
    // Career fields - repeat 3 times for strong emphasis (most important)
    if (formData.careerFields.length > 0) {
      const careerFieldsStr = formData.careerFields.join(', ')
      cleansed.push(careerFieldsStr)
      cleansed.push(careerFieldsStr) // Repeat 1
      cleansed.push(careerFieldsStr) // Repeat 2
    }
    
    // Engineering types - if selected, add them to the cleansed query
    if (formData.engineeringTypes.length > 0) {
      const engineeringTypesStr = formData.engineeringTypes.join(', ')
      cleansed.push(engineeringTypesStr)
      cleansed.push(engineeringTypesStr) // Repeat for emphasis
    }
    
    
    // Activities - repeat 2 times for emphasis (important)
    if (formData.activities.length > 0) {
      const activitiesStr = formData.activities.join(', ')
      cleansed.push(activitiesStr)
      cleansed.push(activitiesStr) // Repeat once for emphasis
    }
    
    // Hobbies - include but don't repeat (moderately important)
    if (formData.hobbies) {
      cleansed.push(formData.hobbies)
    }
    if (formData.additionalHobbies.length > 0) {
      cleansed.push(formData.additionalHobbies.join(', '))
    }
    
    // Classification - REMOVED from query to reduce bias
    // Note: Classification is still used for filtering eligibility in check_eligibility(),
    // but we don't include it in the search query to avoid over-weighting classification-focused orgs
    
    // Lives on campus - less important
    const campusStatus = formData.livesOnCampus === 'Yes' ? 'on-campus' : formData.livesOnCampus === 'No' ? 'off-campus' : ''
    if (campusStatus) {
      cleansed.push(campusStatus)
    }
    if (formData.livesOnCampus === 'Yes' && formData.hall) {
      cleansed.push(formData.hall)
    }
    
    // Demographics - include but don't emphasize (filtering only, not for matching)
    const raceValue = formData.race + (formData.raceOther ? ` (${formData.raceOther})` : '')
    if (formData.race) {
      cleansed.push(raceValue)
    }
    
    if (formData.sexuality && formData.sexuality !== 'Straight') {
      if (formData.sexuality === 'Other' && formData.sexualityOther) {
        cleansed.push(formData.sexualityOther)
      } else if (formData.sexuality !== 'Other') {
        cleansed.push(formData.sexuality)
      }
    }
    
    if (formData.gender) {
      if (formData.gender === 'Other' && formData.genderOther) {
        cleansed.push(formData.genderOther)
      } else if (formData.gender !== 'Other') {
        cleansed.push(formData.gender)
      }
    }
    
    // Religion (if interested)
    if (formData.interestedInReligiousOrgs === 'Yes' && formData.religion) {
      cleansed.push(formData.religion)
    }
    
    const finalCleansedString = cleansed.join(' | ')
    setCleansedString(finalCleansedString)
    
    // Extract keywords for insights
    const keywords = finalCleansedString
      .split(/[|,]/)
      .map(k => k.trim())
      .filter(k => k.length > 0)
    setQueryKeywords(keywords)
    
    setShowResults(true)
    setCurrentStep(steps.length - 1)
    
    setIsLoading(true)
    setSearchError('')
    
    // Save user query to database FIRST (independent of search success)
    // This ensures data is saved even if search fails
    fetch('/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: formData.name,
        email: formData.email,
        query: finalCleansedString,
        cleansedQuery: finalCleansedString,
        queryKeywords: keywords,
        website: honeypot // Honeypot field
      })
    }).catch(err => {
      console.error('Failed to save query:', err)
      // Silently fail - don't interrupt user experience
    })
    
    const userDataForSearch = {
      gender: formData.gender || formData.genderOther || '',
      race: formData.race || formData.raceOther || '',
      classification: formData.classification || '',
      sexuality: formData.sexuality || formData.sexualityOther || '',
      careerFields: formData.careerFields || [],
      engineeringTypes: formData.engineeringTypes || [],
      religion: formData.religion === 'Other' ? formData.religionOther : formData.religion || ''
    }
    
    // Try to search, but handle errors gracefully
    fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: finalCleansedString,
        userData: userDataForSearch
      })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => {
            throw new Error(data.error || `HTTP error! status: ${res.status}`)
          })
        }
        return res.json()
      })
      .then(data => {
        setIsLoading(false)
        if (data.error) {
          setSearchError(data.error)
        } else {
          const results = data.results || []
          setAllSearchResults(results)
          setSearchResults(results)
          setSelectedFilter('')
        }
      })
      .catch(err => {
        setIsLoading(false)
        console.error('Search error:', err)
        // Show actual error message for debugging
        setSearchError(`Search error: ${err.message || 'Unknown error'}. Your form has been submitted successfully.`)
        // Set empty results so UI doesn't break
        setAllSearchResults([])
        setSearchResults([])
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleCareerField = (field: string) => {
    setFormData(prev => {
      const newCareerFields = prev.careerFields.includes(field)
        ? prev.careerFields.filter(f => f !== field)
        : [...prev.careerFields, field]
      
      // If Engineering is deselected, clear engineeringTypes
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

  const filterResults = (filter: string) => {
    const filtered = allSearchResults.filter(org => {
      const activities = (org.typical_activities || '').toLowerCase()
      const bio = (org.bio_snippet || org.bio || '').toLowerCase()
      const combined = `${activities} ${bio}`.toLowerCase()
      
      switch (filter) {
        case 'Volunteering':
          return combined.includes('volunteer') ||
                 combined.includes('service') ||
                 combined.includes('community service') ||
                 activities.includes('volunteering')
                 
        case 'Social Events':
          return combined.includes('social event') ||
                 combined.includes('social gathering') ||
                 combined.includes('networking event') ||
                 combined.includes('mixer') ||
                 combined.includes('party') ||
                 activities.includes('social events') ||
                 activities.includes('social')
                 
        case 'Projects':
          return combined.includes('project') ||
                 combined.includes('collaborative work') ||
                 activities.includes('projects') ||
                 activities.includes('project')
                 
        case 'Competitions':
          return combined.includes('competition') ||
                 combined.includes('competitions') ||
                 combined.includes('tournament') ||
                 combined.includes('contest') ||
                 combined.includes('hackathon') ||
                 activities.includes('competitions') ||
                 activities.includes('competitive')
                 
        case 'Workshops':
          return combined.includes('workshop') ||
                 combined.includes('training') ||
                 combined.includes('seminar') ||
                 activities.includes('workshops') ||
                 activities.includes('workshop')
                 
        case 'Trips':
          return combined.includes('trip') ||
                 combined.includes('travel') ||
                 combined.includes('excursion') ||
                 combined.includes('field trip') ||
                 activities.includes('trips') ||
                 activities.includes('trip')
                 
        default:
          return true
      }
    })
    
    setSearchResults(filtered)
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
          <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
            <img 
              src="/logo.png" 
              alt="ORGanize TAMU Logo" 
              className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 flex-shrink-0 object-contain"
            />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-tamu-maroon">
              ORGanize TAMU
          </h1>
          </div>
          <p className="text-gray-600 text-sm sm:text-base md:text-lg mb-2 px-2">
            Find your perfect organization match
          </p>
          <div className="w-24 h-1 bg-tamu-maroon mx-auto"></div>
        </motion.div>

        {/* Progress Bar */}
        {!showResults && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">
                Step {currentStep + 1} of {steps.length - 1}
              </span>
              <span className="text-sm font-semibold text-tamu-maroon">
                {steps[currentStep]}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div
                className="bg-tamu-maroon h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${((currentStep + 1) / (steps.length - 1)) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}

        {/* Form Content */}
        <AnimatePresence mode="wait">
          {!showResults ? (
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
                        required
                      />
                    </div>
                    <div>
                        <label className="block text-gray-700 font-medium mb-1 sm:mb-2 text-sm sm:text-base">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full p-2.5 sm:p-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                    {/* Honeypot field - hidden from users */}
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
                  
                  {/* Engineering Types Selection */}
                  {formData.careerFields.includes('Engineering') && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200"
                    >
                      <h3 className="text-lg sm:text-xl font-semibold text-tamu-maroon mb-3 sm:mb-4">
                        Which types of engineering are you interested in? *
                      </h3>
                      
                      {/* Search Input */}
                      <div className="relative">
                        <input
                          type="text"
                          value={engineeringTypeInput}
                          onChange={(e) => {
                            setEngineeringTypeInput(e.target.value)
                            setShowEngineeringDropdown(true)
                          }}
                          onFocus={() => setShowEngineeringDropdown(true)}
                          onBlur={() => {
                            // Delay to allow click events to fire
                            setTimeout(() => setShowEngineeringDropdown(false), 200)
                          }}
                          placeholder="Search and select engineering types..."
                          className="w-full p-2.5 sm:p-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                        />
                        
                        {/* Dropdown List */}
                        {showEngineeringDropdown && filteredEngineeringTypes.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {filteredEngineeringTypes.map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => toggleEngineeringType(type)}
                                className="w-full text-left px-4 py-2 text-sm sm:text-base hover:bg-tamu-maroon-light hover:text-white transition-colors first:rounded-t-lg last:rounded-b-lg"
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Selected Engineering Types as Tags */}
                      {formData.engineeringTypes.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {formData.engineeringTypes.map((type) => (
                            <motion.div
                              key={type}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              whileHover={{ scale: 1.05 }}
                              className="flex items-center gap-2 px-3 py-1 rounded-full bg-tamu-maroon text-white text-sm"
                            >
                              <span>{type}</span>
                              <button
                                type="button"
                                onClick={() => toggleEngineeringType(type)}
                                className="ml-1 text-xs font-bold hover:text-gray-200"
                              >
                                ×
                              </button>
                            </motion.div>
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
                    <div className="space-y-3 sm:space-y-4">
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
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4"
                      >
                      <label className="block text-gray-700 font-medium mb-1 sm:mb-2 text-sm sm:text-base">
                          What hall?
                        </label>
                        <input
                          type="text"
                          value={formData.hall}
                          onChange={(e) => setFormData(prev => ({ ...prev, hall: e.target.value }))}
                          className="w-full p-2.5 sm:p-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                          placeholder="Enter hall name"
                        />
                      </motion.div>
                    )}
                  </div>
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
                    <h3 className="text-lg sm:text-xl font-semibold text-tamu-maroon mb-3 sm:mb-4">
                      What&apos;s your race?
                    </h3>
                    <div className="space-y-2 sm:space-y-3">
                      {RACES.map((race) => (
                        <motion.button
                          key={race}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setFormData(prev => ({ ...prev, race }))}
                          className={`w-full p-3 sm:p-4 rounded-lg border-2 text-left text-sm sm:text-base transition-all ${
                            formData.race === race
                              ? 'border-tamu-maroon bg-tamu-maroon text-white'
                              : 'border-gray-300 hover:border-tamu-maroon-light'
                          }`}
                        >
                          {race}
                        </motion.button>
                      ))}
                    </div>
                    {formData.race === 'Other/Multiple' && (
                      <motion.input
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        type="text"
                        value={formData.raceOther}
                        onChange={(e) => setFormData(prev => ({ ...prev, raceOther: e.target.value }))}
                        className="mt-4 w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                        placeholder="Please specify"
                      />
                    )}
                  </div>

                  {/* Sexuality */}
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold text-tamu-maroon mb-3 sm:mb-4">
                      What&apos;s your sexuality?
                    </h3>
                    <div className="space-y-2 sm:space-y-3">
                      {SEXUALITIES.map((sexuality) => (
                        <motion.button
                          key={sexuality}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setFormData(prev => ({ ...prev, sexuality }))}
                          className={`w-full p-3 sm:p-4 rounded-lg border-2 text-left text-sm sm:text-base transition-all ${
                            formData.sexuality === sexuality
                              ? 'border-tamu-maroon bg-tamu-maroon text-white'
                              : 'border-gray-300 hover:border-tamu-maroon-light'
                          }`}
                        >
                          {sexuality}
                        </motion.button>
                      ))}
                    </div>
                    {formData.sexuality === 'Other' && (
                      <motion.input
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        type="text"
                        value={formData.sexualityOther}
                        onChange={(e) => setFormData(prev => ({ ...prev, sexualityOther: e.target.value }))}
                        className="mt-4 w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                        placeholder="Please specify"
                      />
                    )}
                  </div>

                  {/* Gender */}
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold text-tamu-maroon mb-3 sm:mb-4">
                      What&apos;s your gender?
                    </h3>
                    <div className="space-y-2 sm:space-y-3">
                      {GENDERS.map((gender) => (
                        <motion.button
                          key={gender}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setFormData(prev => ({ ...prev, gender }))}
                          className={`w-full p-3 sm:p-4 rounded-lg border-2 text-left text-sm sm:text-base transition-all ${
                            formData.gender === gender
                              ? 'border-tamu-maroon bg-tamu-maroon text-white'
                              : 'border-gray-300 hover:border-tamu-maroon-light'
                          }`}
                        >
                          {gender}
                        </motion.button>
                      ))}
                    </div>
                    {formData.gender === 'Other' && (
                      <motion.input
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        type="text"
                        value={formData.genderOther}
                        onChange={(e) => setFormData(prev => ({ ...prev, genderOther: e.target.value }))}
                        className="mt-4 w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                        placeholder="Please specify"
                      />
                    )}
                  </div>

                  {/* Hobbies */}
                  <div>
                    <h3 className="text-xl font-semibold text-tamu-maroon mb-4">
                      Tell us about your hobbies.
                    </h3>

                    {/* Additional hobbies as tags */}
                    <div>
                      <label className="block text-gray-700 font-medium mb-1 sm:mb-2 text-xs sm:text-sm">
                        Add specific hobbies and career interests (press Enter after each one)
                      </label>
                      <input
                        type="text"
                        value={additionalHobbyInput}
                        onChange={(e) => setAdditionalHobbyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const value = additionalHobbyInput.trim()
                            if (!value) return
                            setFormData(prev => ({
                              ...prev,
                              additionalHobbies: prev.additionalHobbies.includes(value)
                                ? prev.additionalHobbies
                                : [...prev.additionalHobbies, value],
                            }))
                            setAdditionalHobbyInput('')
                          }
                        }}
                        className="w-full p-2.5 sm:p-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                        placeholder="Type a hobby and press Enter"
                      />

                      {formData.additionalHobbies.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {formData.additionalHobbies.map((hobby) => (
                            <motion.div
                              key={hobby}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              whileHover={{ scale: 1.05 }}
                              className="flex items-center gap-2 px-3 py-1 rounded-full bg-tamu-maroon text-white text-sm"
                            >
                              <span>{hobby}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setFormData(prev => ({
                                    ...prev,
                                    additionalHobbies: prev.additionalHobbies.filter((h) => h !== hobby),
                                  }))
                                }
                                className="ml-1 text-xs font-bold hover:text-gray-200"
                              >
                                ×
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Activities & Goals */}
              {currentStep === 5 && (
                <div className="space-y-8">
                  {/* Activities */}
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold text-tamu-maroon mb-3 sm:mb-4">
                      Which of these activities sounds most appealing to you? *
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {ACTIVITIES.map((activity) => (
                        <motion.button
                          key={activity}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => toggleActivity(activity)}
                          className={`p-3 sm:p-4 rounded-lg border-2 text-left text-sm sm:text-base transition-all ${
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

                  {/* Religious Orgs */}
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold text-tamu-maroon mb-3 sm:mb-4">
                      Are you interested in religious organizations? *
                    </h3>
                    <div className="flex gap-2 sm:gap-4 mb-4">
                      {['Yes', 'No'].map((option) => (
                        <motion.button
                          key={option}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setFormData(prev => ({ ...prev, interestedInReligiousOrgs: option, religion: option === 'No' ? '' : prev.religion }))}
                          className={`flex-1 p-3 sm:p-4 rounded-lg border-2 text-sm sm:text-base font-semibold transition-all ${
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
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                      >
                              <h4 className="text-base sm:text-lg font-medium text-gray-700 mb-2 sm:mb-3">
                          <span className="text-base sm:text-lg">What is your religion? *</span>
                        </h4>
                        <div className="space-y-3">
                          {RELIGIONS.map((religion) => (
                            <motion.button
                              key={religion}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setFormData(prev => ({ 
                                ...prev, 
                                religion,
                                religionOther: religion === 'Other' ? prev.religionOther : ''
                              }))}
                              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                                formData.religion === religion
                                  ? 'border-tamu-maroon bg-tamu-maroon text-white'
                                  : 'border-gray-300 hover:border-tamu-maroon-light'
                              }`}
                            >
                              {religion}
                            </motion.button>
                          ))}
                        </div>
                        {formData.religion === 'Other' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-4"
                          >
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                              Please specify your religion:
                            </label>
                            <input
                              type="text"
                              value={formData.religionOther}
                              onChange={(e) => setFormData(prev => ({ ...prev, religionOther: e.target.value }))}
                              placeholder="Enter your religion *"
                              className="w-full px-3 py-2 sm:px-4 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                              required
                            />
                          </motion.div>
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
                {currentStep < steps.length - 2 ? (
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
                    {isSubmitting ? 'Submitting...' : 'Submit'}
                  </motion.button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl sm:text-2xl font-semibold text-tamu-maroon">
                  Recommended Organizations
                </h2>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowInsights(!showInsights)}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-200 text-gray-700 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-300 transition-all"
                >
                  {showInsights ? 'Hide' : 'Show'} Insights
                </motion.button>
              </div>
              
              {/* Search Insights Panel */}
              {showInsights && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 sm:p-4 md:p-6 mb-4 sm:mb-6"
                >
                  <h3 className="text-lg font-semibold text-blue-900 mb-4">
                    Search Process Insights
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Query String */}
                    <div>
                      <p className="text-sm font-semibold text-blue-800 mb-2">Query String:</p>
                      <div className="bg-white p-3 rounded border border-blue-200">
                        <code className="text-sm text-gray-700 break-all">{cleansedString}</code>
                      </div>
                    </div>
                    
                    {/* Keywords */}
                    <div>
                      <p className="text-sm font-semibold text-blue-800 mb-2">
                        Extracted Keywords ({queryKeywords.length}):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {queryKeywords.map((keyword, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Scoring Weights */}
                    <div>
                      <p className="text-sm font-semibold text-blue-800 mb-2">Scoring Weights:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                        <div className="bg-white p-2 rounded border border-blue-200">
                          <span className="font-semibold">Name:</span> 10pts
                        </div>
                        <div className="bg-white p-2 rounded border border-blue-200">
                          <span className="font-semibold">Majors:</span> 10pts
                        </div>
                        <div className="bg-white p-2 rounded border border-blue-200">
                          <span className="font-semibold">Activities:</span> 5pts
                        </div>
                        <div className="bg-white p-2 rounded border border-blue-200">
                          <span className="font-semibold">Culture:</span> 5pts
                        </div>
                        <div className="bg-white p-2 rounded border border-blue-200">
                          <span className="font-semibold">Bio:</span> 1pt
                        </div>
                      </div>
                    </div>
                    
                    {/* User Data for Filtering */}
                    <div>
                      <p className="text-sm font-semibold text-blue-800 mb-2">Eligibility Filters Applied:</p>
                      <div className="bg-white p-3 rounded border border-blue-200 text-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {formData.gender && (
                            <div><span className="font-semibold">Gender:</span> {formData.gender}{formData.genderOther ? ` (${formData.genderOther})` : ''}</div>
                          )}
                          {formData.race && (
                            <div><span className="font-semibold">Race:</span> {formData.race}{formData.raceOther ? ` (${formData.raceOther})` : ''}</div>
                          )}
                          {formData.classification && (
                            <div><span className="font-semibold">Classification:</span> {formData.classification}</div>
                          )}
                          {formData.sexuality && formData.sexuality !== 'Straight' && (
                            <div><span className="font-semibold">Sexuality:</span> {formData.sexuality}{formData.sexualityOther ? ` (${formData.sexualityOther})` : ''}</div>
                          )}
                          {formData.careerFields.length > 0 && (
                            <div className="col-span-2"><span className="font-semibold">Career Fields:</span> {formData.careerFields.join(', ')}</div>
                          )}
                          {formData.engineeringTypes.length > 0 && (
                            <div className="col-span-2"><span className="font-semibold">Engineering Types:</span> {formData.engineeringTypes.join(', ')}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Results Summary */}
                    {allSearchResults.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-blue-800 mb-2">Results Summary:</p>
                        <div className="bg-white p-3 rounded border border-blue-200 text-sm">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                            <div>
                              <span className="font-semibold">Total Found:</span> {allSearchResults.length}
                            </div>
                            <div>
                              <span className="font-semibold">Currently Showing:</span> {searchResults.length}
                            </div>
                            <div>
                              <span className="font-semibold">Top Score:</span> {allSearchResults[0]?.relevance_score || 0}
                            </div>
                          </div>
                          {allSearchResults.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-blue-200">
                              <p className="text-xs text-gray-600 mb-1">Score Distribution:</p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs">Min: {Math.min(...allSearchResults.map(r => r.relevance_score))}</span>
                                <span className="text-xs">|</span>
                                <span className="text-xs">Max: {Math.max(...allSearchResults.map(r => r.relevance_score))}</span>
                                <span className="text-xs">|</span>
                                <span className="text-xs">Avg: {Math.round(allSearchResults.reduce((sum, r) => sum + r.relevance_score, 0) / allSearchResults.length)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
              
              {/* Filter Buttons */}
              {allSearchResults.length > 0 && (
                <div className="mb-4 sm:mb-6">
                  <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">Filter by activity type:</p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelectedFilter('')
                        setSearchResults(allSearchResults)
                      }}
                      className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                        selectedFilter === ''
                          ? 'bg-tamu-maroon text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      All
                    </motion.button>
                    {ACTIVITIES.map((activity) => (
                      <motion.button
                        key={activity}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setSelectedFilter(activity)
                          filterResults(activity)
                        }}
                        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                          selectedFilter === activity
                            ? 'bg-tamu-maroon text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {activity}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
                  <span className="ml-4 text-gray-600">Searching organizations...</span>
                </div>
              )}
              
              {/* Error State */}
              {searchError && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
                  <p className="text-red-800 font-semibold">Error</p>
                  <p className="text-red-600 text-sm">{searchError}</p>
                </div>
              )}
              
              {/* Search Results */}
              {!isLoading && !searchError && searchResults.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <p className="text-xs sm:text-sm text-gray-600">
                      Found {searchResults.length} organization{searchResults.length !== 1 ? 's' : ''} with matching results
                      {allSearchResults.length > 0 && searchResults.length === allSearchResults.length && (
                        <span className="text-xs text-gray-500 ml-1 sm:ml-2 block sm:inline">
                          (showing all organizations with nonzero scores)
                        </span>
                      )}
                    </p>
                    {searchResults.length > 50 && (
                      <p className="text-xs text-gray-500">
                        Scroll to see all results
                      </p>
                    )}
                  </div>
                  <div className="max-h-[600px] sm:max-h-[800px] overflow-y-auto pr-1 sm:pr-2 space-y-3 sm:space-y-4">
                  {searchResults.map((org, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedOrg(org)}
                      className="border-2 border-gray-200 rounded-lg p-3 sm:p-4 md:p-6 hover:border-tamu-maroon-light transition-all cursor-pointer"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                        <h3 className="text-lg sm:text-xl font-semibold text-tamu-maroon">
                          {org.name}
                        </h3>
                        <span className="px-2.5 py-1 sm:px-3 sm:py-1 bg-tamu-maroon text-white rounded-full text-xs sm:text-sm font-medium self-start sm:self-auto">
                          Score: {org.relevance_score}
                        </span>
                      </div>
                      
                      {org.typical_majors && org.typical_majors !== 'nan' && (
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="font-semibold">Majors:</span> {org.typical_majors}
                        </p>
                      )}
                      
                      {org.typical_activities && org.typical_activities !== 'nan' && (
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="font-semibold">Activities:</span> {org.typical_activities}
                        </p>
                      )}
                      
                      {org.club_culture_style && org.club_culture_style !== 'nan' && (
                        <p className="text-sm text-gray-600 mb-3">
                          <span className="font-semibold">Culture:</span> {org.club_culture_style}
                        </p>
                      )}
                      
                      {org.bio_snippet && (
                        <p className="text-gray-700 text-sm leading-relaxed">
                          {org.bio_snippet}
                        </p>
                      )}
                      
                      {/* Score Breakdown (shown in insights mode) */}
                      {showInsights && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-xs font-semibold text-gray-600 mb-2">Score Breakdown:</p>
                          {org.score_breakdown ? (
                            <div className="text-xs text-gray-500 space-y-1">
                              <div>Total Score: <span className="font-semibold text-tamu-maroon">{org.relevance_score} points</span></div>
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <div>Name matches: <span className="font-semibold">{org.score_breakdown.name_matches}pts</span></div>
                                <div>Majors matches: <span className="font-semibold">{org.score_breakdown.majors_matches}pts</span></div>
                                <div>Activities matches: <span className="font-semibold">{org.score_breakdown.activities_matches}pts</span></div>
                                <div>Culture matches: <span className="font-semibold">{org.score_breakdown.culture_matches}pts</span></div>
                                <div>Bio matches: <span className="font-semibold">{org.score_breakdown.bio_matches}pts</span></div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 space-y-1">
                              <div>Total Score: <span className="font-semibold text-tamu-maroon">{org.relevance_score} points</span></div>
                              {queryKeywords.length > 0 && (
                                <div className="mt-2">
                                  <p className="font-semibold mb-1">Keyword Matches:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {queryKeywords.slice(0, 10).map((keyword, idx) => {
                                      const keywordLower = keyword.toLowerCase()
                                      const nameMatch = (org.name || '').toLowerCase().includes(keywordLower)
                                      const majorsMatch = (org.typical_majors || '').toLowerCase().includes(keywordLower)
                                      const activitiesMatch = (org.typical_activities || '').toLowerCase().includes(keywordLower)
                                      const cultureMatch = (org.club_culture_style || '').toLowerCase().includes(keywordLower)
                                      const bioMatch = (org.bio_snippet || '').toLowerCase().includes(keywordLower)
                                      const hasMatch = nameMatch || majorsMatch || activitiesMatch || cultureMatch || bioMatch
                                      
                                      if (!hasMatch) return null
                                      
                                      return (
                                        <span
                                          key={idx}
                                          className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs"
                                          title={`Matches: ${[
                                            nameMatch && 'Name (+10)',
                                            majorsMatch && 'Majors (+10)',
                                            activitiesMatch && 'Activities (+5)',
                                            cultureMatch && 'Culture (+5)',
                                            bioMatch && 'Bio (+1)'
                                          ].filter(Boolean).join(', ')}`}
                                        >
                                          {keyword}
                                        </span>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                  </div>
                </div>
              )}
              
              {/* No Results */}
              {!isLoading && !searchError && searchResults.length === 0 && allSearchResults.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-600">No organizations found matching your criteria.</p>
                </div>
              )}
              
              {/* No Results After Filtering */}
              {!isLoading && !searchError && searchResults.length === 0 && allSearchResults.length > 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-600">No organizations match the selected filter.</p>
                  <button
                    onClick={() => {
                      setSelectedFilter('')
                      setSearchResults(allSearchResults)
                    }}
                    className="mt-4 text-tamu-maroon hover:underline"
                  >
                    Clear filter
                  </button>
                </div>
              )}

              {/* Organization Detail Modal */}
              <AnimatePresence>
                {selectedOrg && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedOrg(null)}
                      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4"
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
                      >
                        <div className="sticky top-0 bg-gradient-to-r from-tamu-maroon to-tamu-maroon-light p-3 sm:p-4 md:p-6 text-white flex justify-between items-start">
                          <div className="flex-1 pr-2">
                            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 break-words">{selectedOrg.name}</h2>
                            <span className="px-2 py-1 sm:px-3 sm:py-1 bg-white/20 rounded-full text-xs sm:text-sm font-medium">
                              Score: {selectedOrg.relevance_score}
                            </span>
                          </div>
                          <button
                            onClick={() => setSelectedOrg(null)}
                            className="text-white hover:text-gray-200 text-2xl sm:text-3xl font-bold flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center"
                            aria-label="Close"
                          >
                            ×
                          </button>
                        </div>

                        <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
                          {/* Full Bio */}
                          {selectedOrg.full_bio && selectedOrg.full_bio !== 'nan' && (
                            <div>
                              <h3 className="text-base sm:text-lg font-semibold text-tamu-maroon mb-2">About</h3>
                              <p className="text-sm sm:text-base text-gray-700 leading-relaxed">{selectedOrg.full_bio}</p>
                            </div>
                          )}

                          {/* Contact Information */}
                          {(selectedOrg.website || selectedOrg.administrative_contact_info) && (
                            <div className="border-t pt-4">
                              <h3 className="text-base sm:text-lg font-semibold text-tamu-maroon mb-2 sm:mb-3">Contact Information</h3>
                              <div className="space-y-2">
                                {selectedOrg.website && selectedOrg.website !== 'nan' && (
                                  <div>
                                    <span className="font-semibold text-gray-700">Website: </span>
                                    <a
                                      href={selectedOrg.website.startsWith('http') ? selectedOrg.website : `https://${selectedOrg.website}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-tamu-maroon hover:underline"
                                    >
                                      {selectedOrg.website}
                                    </a>
                                  </div>
                                )}
                                {selectedOrg.administrative_contact_info && selectedOrg.administrative_contact_info !== 'nan' && (
                                  <div>
                                    <span className="font-semibold text-gray-700">Contact: </span>
                                    <span className="text-gray-700">{selectedOrg.administrative_contact_info}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Additional Details */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-t pt-4">
                            {selectedOrg.typical_majors && selectedOrg.typical_majors !== 'nan' && (
                              <div>
                                <h4 className="font-semibold text-gray-700 mb-1">Typical Majors</h4>
                                <p className="text-gray-600">{selectedOrg.typical_majors}</p>
                              </div>
                            )}
                            {selectedOrg.typical_activities && selectedOrg.typical_activities !== 'nan' && (
                              <div>
                                <h4 className="font-semibold text-gray-700 mb-1">Typical Activities</h4>
                                <p className="text-gray-600">{selectedOrg.typical_activities}</p>
                              </div>
                            )}
                            {selectedOrg.club_culture_style && selectedOrg.club_culture_style !== 'nan' && (
                              <div>
                                <h4 className="font-semibold text-gray-700 mb-1">Club Culture</h4>
                                <p className="text-gray-600">{selectedOrg.club_culture_style}</p>
                              </div>
                            )}
                            {selectedOrg.meeting_frequency && selectedOrg.meeting_frequency !== 'nan' && (
                              <div>
                                <h4 className="font-semibold text-gray-700 mb-1">Meeting Frequency</h4>
                                <p className="text-gray-600">{selectedOrg.meeting_frequency}</p>
                              </div>
                            )}
                            {selectedOrg.meeting_times && selectedOrg.meeting_times !== 'nan' && (
                              <div>
                                <h4 className="font-semibold text-gray-700 mb-1">Meeting Times</h4>
                                <p className="text-gray-600">{selectedOrg.meeting_times}</p>
                              </div>
                            )}
                            {selectedOrg.meeting_locations && selectedOrg.meeting_locations !== 'nan' && (
                              <div>
                                <h4 className="font-semibold text-gray-700 mb-1">Meeting Locations</h4>
                                <p className="text-gray-600">{selectedOrg.meeting_locations}</p>
                              </div>
                            )}
                            {selectedOrg.dues_required && selectedOrg.dues_required !== 'nan' && (
                              <div>
                                <h4 className="font-semibold text-gray-700 mb-1">Dues Required</h4>
                                <p className="text-gray-600">
                                  {selectedOrg.dues_required}
                                  {selectedOrg.dues_cost && selectedOrg.dues_cost !== 'nan' && ` - ${selectedOrg.dues_cost}`}
                                </p>
                              </div>
                            )}
                            {selectedOrg.application_required && selectedOrg.application_required !== 'nan' && (
                              <div>
                                <h4 className="font-semibold text-gray-700 mb-1">Application Required</h4>
                                <p className="text-gray-600">{selectedOrg.application_required}</p>
                              </div>
                            )}
                            {selectedOrg.time_commitment && selectedOrg.time_commitment !== 'nan' && (
                              <div>
                                <h4 className="font-semibold text-gray-700 mb-1">Time Commitment</h4>
                                <p className="text-gray-600">{selectedOrg.time_commitment}</p>
                              </div>
                            )}
                            {selectedOrg.member_count && selectedOrg.member_count !== 'nan' && (
                              <div>
                                <h4 className="font-semibold text-gray-700 mb-1">Member Count</h4>
                                <p className="text-gray-600">{selectedOrg.member_count}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setShowResults(false)
                  setCurrentStep(0)
                  setResultsString('')
                  setCleansedString('')
                  setSearchResults([])
                  setAllSearchResults([])
                  setSelectedFilter('')
                  setSearchError('')
                  setSelectedOrg(null)
                  setFormData({
                    name: '',
                    email: '',
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
                  setAdditionalHobbyInput('')
                  setEngineeringTypeInput('')
                  setShowEngineeringDropdown(false)
                }}
                className="mt-4 sm:mt-6 px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light transition-all"
              >
                Start New Survey
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

