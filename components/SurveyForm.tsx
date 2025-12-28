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

const PRIMARY_GOALS = [
  'Building my resume / Career help',
  'Making friends / Having fun',
  'Volunteering / Giving back',
  'Playing sports / Being active'
]

interface SurveyData {
  careerFields: string[]
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
    careerFields: [],
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
  const [showResults, setShowResults] = useState(false)
  const [resultsString, setResultsString] = useState('')
  const [cleansedString, setCleansedString] = useState('')
  const [additionalHobbyInput, setAdditionalHobbyInput] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [allSearchResults, setAllSearchResults] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<string>('')
  const [showInsights, setShowInsights] = useState(false)
  const [queryKeywords, setQueryKeywords] = useState<string[]>([])

  const steps = [
    'Career Fields',
    'Housing',
    'Classification',
    'Demographics',
    'Activities',
    'Results'
  ]

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = () => {
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
    
    const userDataForSearch = {
      gender: formData.gender || formData.genderOther || '',
      race: formData.race || formData.raceOther || '',
      classification: formData.classification || '',
      sexuality: formData.sexuality || formData.sexualityOther || '',
      careerFields: formData.careerFields || [],
      religion: formData.religion === 'Other' ? formData.religionOther : formData.religion || ''
    }
    
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
        setSearchError(err.message || 'Failed to search organizations. Please try again.')
      })
  }

  const toggleCareerField = (field: string) => {
    setFormData(prev => ({
      ...prev,
      careerFields: prev.careerFields.includes(field)
        ? prev.careerFields.filter(f => f !== field)
        : [...prev.careerFields, field]
    }))
  }

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
      const bio = (org.bio_snippet || org.bio || '').toLowerCase()
      const activities = (org.typical_activities || '').toLowerCase()
      const clubType = (org.club_culture_style || '').toLowerCase()
      const name = (org.name || '').toLowerCase()
      const combined = `${bio} ${activities} ${clubType} ${name}`.toLowerCase()
      
      switch (filter) {
        case 'Building my resume / Career help':
          const careerKeywords = ['career', 'professional', 'resume', 'networking', 'mentorship', 'leadership', 'skill', 'development', 'industry']
          const hasCareerFocus = careerKeywords.some(keyword => combined.includes(keyword))
          
          const careerFieldsLower = formData.careerFields.map(f => f.toLowerCase())
          const matchesCareerField = careerFieldsLower.some(field => {
            const fieldKeywords: { [key: string]: string[] } = {
              'engineering': ['engineering', 'engineer', 'tech'],
              'technology/computer science': ['computer', 'technology', 'tech', 'cs', 'programming', 'software', 'coding'],
              'business/finance': ['business', 'finance', 'mays', 'accounting', 'economics'],
              'medicine/healthcare': ['medicine', 'medical', 'health', 'pre-med', 'bims', 'biology'],
              'law': ['law', 'legal', 'pre-law'],
              'education': ['education', 'teaching'],
              'arts/design': ['art', 'arts', 'design', 'graphic'],
              'science/research': ['science', 'research', 'chemistry', 'physics'],
              'agriculture': ['agriculture', 'ag'],
              'communication/media': ['communication', 'media', 'journalism'],
              'social work': ['social work', 'social'],
              'government/public service': ['government', 'public', 'political'],
              'sports/fitness': ['sports', 'fitness', 'athletic'],
              'hospitality/tourism': ['hospitality', 'tourism']
            }
            const keywords = fieldKeywords[field] || [field]
            return keywords.some(keyword => combined.includes(keyword))
          })
          return hasCareerFocus || matchesCareerField || clubType === 'professional'
          
        case 'Making friends / Having fun':
          return combined.includes('social') || 
                 combined.includes('fun') || 
                 combined.includes('friendship') ||
                 clubType === 'social' ||
                 activities.includes('social events')
                 
        case 'Volunteering / Giving back':
          return combined.includes('volunteer') ||
                 combined.includes('service') ||
                 combined.includes('community') ||
                 activities.includes('volunteering')
                 
        case 'Playing sports / Being active':
          return combined.includes('sport') ||
                 combined.includes('athletic') ||
                 combined.includes('fitness') ||
                 combined.includes('active') ||
                 activities.includes('competitions')
                 
        default:
          return true
      }
    })
    
    setSearchResults(filtered)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-tamu-maroon mb-2">
            Texas A&M University Survey
          </h1>
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
              className="bg-white rounded-lg shadow-lg p-8 mb-6"
            >
              {/* Step 0: Career Fields */}
              {currentStep === 0 && (
                <div>
                  <h2 className="text-2xl font-semibold text-tamu-maroon mb-6">
                    Which career fields are you interested in?
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {CAREER_FIELDS.map((field) => (
                      <motion.button
                        key={field}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleCareerField(field)}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                          formData.careerFields.includes(field)
                            ? 'border-tamu-maroon bg-tamu-maroon text-white'
                            : 'border-gray-300 hover:border-tamu-maroon-light'
                        }`}
                      >
                        {field}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 1: Housing */}
              {currentStep === 1 && (
                <div>
                  <h2 className="text-2xl font-semibold text-tamu-maroon mb-6">
                    Do you live on campus?
                  </h2>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      {['Yes', 'No'].map((option) => (
                        <motion.button
                          key={option}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setFormData(prev => ({ ...prev, livesOnCampus: option }))}
                          className={`flex-1 p-4 rounded-lg border-2 font-semibold transition-all ${
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
                        <label className="block text-gray-700 font-medium mb-2">
                          What hall?
                        </label>
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
                </div>
              )}

              {/* Step 2: Classification */}
              {currentStep === 2 && (
                <div>
                  <h2 className="text-2xl font-semibold text-tamu-maroon mb-6">
                    What classification are you?
                  </h2>
                  <div className="space-y-3">
                    {CLASSIFICATIONS.map((classification) => (
                      <motion.button
                        key={classification}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setFormData(prev => ({ ...prev, classification }))}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
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

              {/* Step 3: Demographics */}
              {currentStep === 3 && (
                <div className="space-y-8">
                  {/* Race */}
                  <div>
                    <h3 className="text-xl font-semibold text-tamu-maroon mb-4">
                      What's your race?
                    </h3>
                    <div className="space-y-3">
                      {RACES.map((race) => (
                        <motion.button
                          key={race}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setFormData(prev => ({ ...prev, race }))}
                          className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
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
                    <h3 className="text-xl font-semibold text-tamu-maroon mb-4">
                      What's your sexuality?
                    </h3>
                    <div className="space-y-3">
                      {SEXUALITIES.map((sexuality) => (
                        <motion.button
                          key={sexuality}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setFormData(prev => ({ ...prev, sexuality }))}
                          className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
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
                    <h3 className="text-xl font-semibold text-tamu-maroon mb-4">
                      What's your gender?
                    </h3>
                    <div className="space-y-3">
                      {GENDERS.map((gender) => (
                        <motion.button
                          key={gender}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setFormData(prev => ({ ...prev, gender }))}
                          className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
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
                      <label className="block text-gray-700 font-medium mb-2">
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
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
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

              {/* Step 4: Activities & Goals */}
              {currentStep === 4 && (
                <div className="space-y-8">
                  {/* Activities */}
                  <div>
                    <h3 className="text-xl font-semibold text-tamu-maroon mb-4">
                      Which of these activities sounds most appealing to you?
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ACTIVITIES.map((activity) => (
                        <motion.button
                          key={activity}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => toggleActivity(activity)}
                          className={`p-4 rounded-lg border-2 text-left transition-all ${
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
                    <h3 className="text-xl font-semibold text-tamu-maroon mb-4">
                      Are you interested in religious organizations?
                    </h3>
                    <div className="flex gap-4 mb-4">
                      {['Yes', 'No'].map((option) => (
                        <motion.button
                          key={option}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setFormData(prev => ({ ...prev, interestedInReligiousOrgs: option, religion: option === 'No' ? '' : prev.religion }))}
                          className={`flex-1 p-4 rounded-lg border-2 font-semibold transition-all ${
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
                        <h4 className="text-lg font-medium text-gray-700 mb-3">
                          What is your religion?
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Please specify your religion:
                            </label>
                            <input
                              type="text"
                              value={formData.religionOther}
                              onChange={(e) => setFormData(prev => ({ ...prev, religionOther: e.target.value }))}
                              placeholder="Enter your religion"
                              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
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
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
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
                    className="px-6 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light transition-all"
                  >
                    Next
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSubmit}
                    className="px-6 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light transition-all"
                  >
                    Submit
                  </motion.button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg shadow-lg p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-tamu-maroon">
                  Recommended Organizations
                </h2>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowInsights(!showInsights)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-all"
                >
                  {showInsights ? 'Hide' : 'Show'} Search Insights
                </motion.button>
              </div>
              
              {/* Search Insights Panel */}
              {showInsights && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6"
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
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
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
                        <div className="grid grid-cols-2 gap-2">
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
                        </div>
                      </div>
                    </div>
                    
                    {/* Results Summary */}
                    {allSearchResults.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-blue-800 mb-2">Results Summary:</p>
                        <div className="bg-white p-3 rounded border border-blue-200 text-sm">
                          <div className="grid grid-cols-3 gap-4">
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
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-3">Filter by goal:</p>
                  <div className="flex flex-wrap gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelectedFilter('')
                        setSearchResults(allSearchResults)
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedFilter === ''
                          ? 'bg-tamu-maroon text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      All
                    </motion.button>
                    {PRIMARY_GOALS.map((goal) => {
                      const displayText = goal === 'Building my resume / Career help'
                        ? `Career building (${formData.careerFields.length > 0 ? formData.careerFields.join(', ') : 'all fields'})`
                        : goal
                      
                      return (
                        <motion.button
                          key={goal}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setSelectedFilter(goal)
                            filterResults(goal)
                          }}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            selectedFilter === goal
                              ? 'bg-tamu-maroon text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {displayText}
                        </motion.button>
                      )
                    })}
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
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                      Found {searchResults.length} organization{searchResults.length !== 1 ? 's' : ''} with matching results
                      {allSearchResults.length > 0 && searchResults.length === allSearchResults.length && (
                        <span className="text-xs text-gray-500 ml-2">
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
                  <div className="max-h-[800px] overflow-y-auto pr-2 space-y-4">
                  {searchResults.map((org, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-2 border-gray-200 rounded-lg p-6 hover:border-tamu-maroon-light transition-all"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-xl font-semibold text-tamu-maroon">
                          {org.name}
                        </h3>
                        <span className="px-3 py-1 bg-tamu-maroon text-white rounded-full text-sm font-medium">
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
                  setFormData({
                    careerFields: [],
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
                }}
                className="mt-6 px-6 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light transition-all"
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

