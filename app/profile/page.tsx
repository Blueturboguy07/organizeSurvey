'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
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
const RACES = ['White', 'Black', 'Hispanic', 'Asian', 'South Asian', 'Pacific Islander', 'Other/Multiple']
const SEXUALITIES = ['Straight', 'Gay', 'Lesbian', 'Other']
const GENDERS = ['Male', 'Female', 'Other']
const ACTIVITIES = ['Volunteering', 'Social Events', 'Projects', 'Competitions', 'Workshops', 'Trips']
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

interface ProfileData {
  name: string | null
  email: string | null
  profilePictureUrl: string | null
  emailPreferences: {
    marketing: boolean
    updates: boolean
    recommendations: boolean
  }
  demographics?: any
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    emailPreferences: {
      marketing: true,
      updates: true,
      recommendations: true
    }
  })
  const [interestsData, setInterestsData] = useState({
    careerFields: [] as string[],
    engineeringTypes: [] as string[],
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
    additionalHobbies: [] as string[],
    activities: [] as string[],
    interestedInReligiousOrgs: '',
    religion: '',
    religionOther: ''
  })
  const [editingInterests, setEditingInterests] = useState(false)
  const [savingInterests, setSavingInterests] = useState(false)
  const [uploadingPicture, setUploadingPicture] = useState(false)
  const [imageError, setImageError] = useState(false)

  // Crop image to square aspect ratio
  const cropImageToSquare = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const img = document.createElement('img')
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d', { willReadFrequently: false })
          if (!ctx) {
            reject(new Error('Could not get canvas context'))
            return
          }

          // Calculate square dimensions (use the smaller dimension)
          const size = Math.min(img.width, img.height)
          
          // Set canvas to exact square dimensions
          canvas.width = size
          canvas.height = size

          // Calculate crop position (center the image)
          const sourceX = (img.width - size) / 2
          const sourceY = (img.height - size) / 2

          // Clear canvas with white background (optional, for transparency issues)
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, size, size)

          // Draw cropped image - source rectangle from original, destination fills entire canvas
          ctx.drawImage(
            img,
            sourceX, sourceY, size, size,  // Source rectangle (what to crop from original)
            0, 0, size, size                 // Destination rectangle (where to draw on canvas)
          )

          // Convert to blob with explicit image format
          const outputType = file.type || 'image/jpeg'
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob'))
                return
              }
              // Verify the blob has content
              if (blob.size === 0) {
                reject(new Error('Cropped image is empty'))
                return
              }
              // Create a new File from the blob with proper extension
              const extension = outputType.includes('png') ? 'png' : outputType.includes('webp') ? 'webp' : 'jpg'
              const croppedFile = new File([blob], `profile.${extension}`, {
                type: outputType,
                lastModified: Date.now()
              })
              resolve(croppedFile)
            },
            outputType,
            0.95 // Quality (0.95 = 95%)
          )
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        if (e.target?.result) {
          img.src = e.target.result as string
        } else {
          reject(new Error('Failed to read file'))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  const loadProfile = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load profile')
      }

      const data = await response.json()
      setProfile(data)
      setFormData({
        name: data.name || '',
        emailPreferences: data.emailPreferences || {
          marketing: true,
          updates: true,
          recommendations: true
        }
      })
      
      // Load demographics/interests if available
      if (data.demographics) {
        setInterestsData({
          careerFields: data.demographics.careerFields || [],
          engineeringTypes: data.demographics.engineeringTypes || [],
          livesOnCampus: data.demographics.livesOnCampus || '',
          hall: data.demographics.hall || '',
          classification: data.demographics.classification || '',
          race: data.demographics.race || '',
          raceOther: data.demographics.raceOther || '',
          sexuality: data.demographics.sexuality || '',
          sexualityOther: data.demographics.sexualityOther || '',
          gender: data.demographics.gender || '',
          genderOther: data.demographics.genderOther || '',
          hobbies: data.demographics.hobbies || '',
          additionalHobbies: data.demographics.additionalHobbies || [],
          activities: data.demographics.activities || [],
          interestedInReligiousOrgs: data.demographics.interestedInReligiousOrgs || '',
          religion: data.demographics.religion || '',
          religionOther: data.demographics.religionOther || ''
        })
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [router, supabase])

  useEffect(() => {
    if (user) {
      loadProfile()
    }
  }, [user, loadProfile])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name: formData.name,
          emailPreferences: formData.emailPreferences
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update profile')
      }

      setSuccess('Profile updated successfully!')
      setEditing(false)
      await loadProfile()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveInterests = async () => {
    setSavingInterests(true)
    setError('')
    setSuccess('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      console.log('📤 Sending interests update:', interestsData)
      const response = await fetch('/api/profile/interests', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(interestsData)
      })

      const responseData = await response.json()
      console.log('📥 Response:', responseData)

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to update interests')
      }

      setSuccess('Interests updated successfully! Your recommendations will be updated.')
      setEditingInterests(false)
      await loadProfile()
      setTimeout(() => setSuccess(''), 5000)
    } catch (err: any) {
      setError(err.message || 'Failed to update interests')
    } finally {
      setSavingInterests(false)
    }
  }

  const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset file input
    e.target.value = ''

    setUploadingPicture(true)
    setError('')

    // Basic validation - check image dimensions before cropping
    try {
      const img = document.createElement('img')
      const url = URL.createObjectURL(file)
      await new Promise((resolve, reject) => {
        img.onload = () => {
          URL.revokeObjectURL(url)
          // Check minimum dimensions (at least 100x100)
          if (img.width < 100 || img.height < 100) {
            reject(new Error('Image must be at least 100x100 pixels'))
            return
          }
          resolve(null)
        }
        img.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error('Invalid image file'))
        }
        img.src = url
      })
    } catch (err: any) {
      setUploadingPicture(false)
      setError(err.message || 'Invalid image file')
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      // Crop image to square aspect ratio
      let croppedFile: File
      try {
        croppedFile = await cropImageToSquare(file)
        console.log('Image cropped successfully. Original size:', file.size, 'Cropped size:', croppedFile.size)
      } catch (cropError: any) {
        console.error('Cropping failed, using original:', cropError)
        // If cropping fails, use original file
        croppedFile = file
      }

      const formData = new FormData()
      formData.append('file', croppedFile, croppedFile.name)

      const response = await fetch('/api/profile/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload picture')
      }

      await loadProfile()
      setImageError(false) // Reset error state on successful upload
      setSuccess('Profile picture updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to upload picture')
    } finally {
      setUploadingPicture(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-tamu-maroon hover:text-tamu-maroon-light mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-tamu-maroon">Profile Settings</h1>
          <p className="text-gray-600 mt-2">Manage your account settings and preferences</p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6"
          >
            <p className="text-green-800">{success}</p>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6"
          >
            <p className="text-red-800">{error}</p>
          </motion.div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-8 space-y-8">
          {/* Profile Picture Section */}
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Profile Picture</h2>
            <div className="flex items-center gap-6">
              <div className="relative">
                {profile?.profilePictureUrl && !imageError ? (
                  <div className="w-[120px] h-[120px] rounded-full overflow-hidden border-4 border-gray-200">
                    <Image
                      src={profile.profilePictureUrl}
                      alt="Profile"
                      width={120}
                      height={120}
                      className="w-full h-full object-cover"
                      style={{ aspectRatio: '1 / 1' }}
                      onError={() => {
                        console.error('Failed to load profile picture:', profile.profilePictureUrl)
                        setImageError(true)
                      }}
                      unoptimized={profile.profilePictureUrl?.includes('supabase.co')}
                    />
                  </div>
                ) : (
                  <div className="w-[120px] h-[120px] rounded-full bg-gray-200 flex items-center justify-center border-4 border-gray-300">
                    <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                {uploadingPicture && (
                  <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
              <div>
                <label className="block">
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handlePictureUpload}
                    disabled={uploadingPicture}
                    className="hidden"
                    id="profile-picture-input"
                  />
                  <motion.button
                    type="button"
                    onClick={() => document.getElementById('profile-picture-input')?.click()}
                    disabled={uploadingPicture}
                    whileHover={{ scale: uploadingPicture ? 1 : 1.02 }}
                    whileTap={{ scale: uploadingPicture ? 1 : 0.98 }}
                    className="px-4 py-2 bg-tamu-maroon text-white rounded-lg font-medium hover:bg-tamu-maroon-light disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingPicture ? 'Uploading...' : 'Change Picture'}
                  </motion.button>
                </label>
                <p className="text-sm text-gray-500 mt-2">JPEG, PNG or WebP. Max 5MB. Image will be cropped to square.</p>
              </div>
            </div>
          </div>

          {/* Profile Information Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-800">Profile Information</h2>
              {!editing && (
                <motion.button
                  onClick={() => setEditing(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 text-tamu-maroon border-2 border-tamu-maroon rounded-lg font-medium hover:bg-tamu-maroon hover:text-white transition-colors"
                >
                  Edit
                </motion.button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Name</label>
                {editing ? (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                    placeholder="Your name"
                  />
                ) : (
                  <p className="p-3 bg-gray-50 rounded-lg">{profile?.name || 'Not set'}</p>
                )}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Email</label>
                <p className="p-3 bg-gray-50 rounded-lg">{profile?.email || user.email}</p>
                <p className="text-sm text-gray-500 mt-1">Email cannot be changed</p>
              </div>
            </div>
          </div>

          {/* Email Preferences Section */}
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Email Preferences</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.emailPreferences.marketing}
                  onChange={(e) => setFormData({
                    ...formData,
                    emailPreferences: {
                      ...formData.emailPreferences,
                      marketing: e.target.checked
                    }
                  })}
                  disabled={!editing}
                  className="w-5 h-5 text-tamu-maroon border-gray-300 rounded focus:ring-tamu-maroon disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div>
                  <span className="font-medium text-gray-700">Marketing Emails</span>
                  <p className="text-sm text-gray-500">Receive emails about new features and updates</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.emailPreferences.updates}
                  onChange={(e) => setFormData({
                    ...formData,
                    emailPreferences: {
                      ...formData.emailPreferences,
                      updates: e.target.checked
                    }
                  })}
                  disabled={!editing}
                  className="w-5 h-5 text-tamu-maroon border-gray-300 rounded focus:ring-tamu-maroon disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div>
                  <span className="font-medium text-gray-700">Account Updates</span>
                  <p className="text-sm text-gray-500">Receive important account and security updates</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.emailPreferences.recommendations}
                  onChange={(e) => setFormData({
                    ...formData,
                    emailPreferences: {
                      ...formData.emailPreferences,
                      recommendations: e.target.checked
                    }
                  })}
                  disabled={!editing}
                  className="w-5 h-5 text-tamu-maroon border-gray-300 rounded focus:ring-tamu-maroon disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div>
                  <span className="font-medium text-gray-700">Organization Recommendations</span>
                  <p className="text-sm text-gray-500">Receive personalized organization recommendations</p>
                </div>
              </label>
            </div>
          </div>

          {/* Interests & Survey Info Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-800">Interests & Information</h2>
                <p className="text-sm text-gray-500 mt-1">Update your interests to get better organization recommendations</p>
              </div>
              {!editingInterests && (
                <motion.button
                  onClick={() => setEditingInterests(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-4 py-2 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light"
                >
                  Edit Interests
                </motion.button>
              )}
            </div>

            {editingInterests ? (
              <div className="space-y-6">
                {/* Career Fields */}
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Career Fields of Interest</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {CAREER_FIELDS.map((field) => (
                      <label key={field} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={interestsData.careerFields.includes(field)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setInterestsData({
                                ...interestsData,
                                careerFields: [...interestsData.careerFields, field]
                              })
                            } else {
                              setInterestsData({
                                ...interestsData,
                                careerFields: interestsData.careerFields.filter(f => f !== field)
                              })
                            }
                          }}
                          className="w-4 h-4 text-tamu-maroon border-gray-300 rounded focus:ring-tamu-maroon"
                        />
                        <span className="text-sm text-gray-700">{field}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Engineering Types (if Engineering is selected) */}
                {interestsData.careerFields.includes('Engineering') && (
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Engineering Types</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                      {ENGINEERING_TYPES.map((type) => (
                        <label key={type} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={interestsData.engineeringTypes.includes(type)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setInterestsData({
                                  ...interestsData,
                                  engineeringTypes: [...interestsData.engineeringTypes, type]
                                })
                              } else {
                                setInterestsData({
                                  ...interestsData,
                                  engineeringTypes: interestsData.engineeringTypes.filter(t => t !== type)
                                })
                              }
                            }}
                            className="w-4 h-4 text-tamu-maroon border-gray-300 rounded focus:ring-tamu-maroon"
                          />
                          <span className="text-sm text-gray-700">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Classification */}
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Classification</label>
                  <select
                    value={interestsData.classification}
                    onChange={(e) => setInterestsData({ ...interestsData, classification: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                  >
                    <option value="">Select classification</option>
                    {CLASSIFICATIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Lives on Campus */}
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Do you live on campus?</label>
                  <div className="flex gap-4">
                    {['Yes', 'No'].map((option) => (
                      <label key={option} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="livesOnCampus"
                          value={option}
                          checked={interestsData.livesOnCampus === option}
                          onChange={(e) => setInterestsData({ ...interestsData, livesOnCampus: e.target.value })}
                          className="w-4 h-4 text-tamu-maroon border-gray-300 focus:ring-tamu-maroon"
                        />
                        <span className="text-gray-700">{option}</span>
                      </label>
                    ))}
                  </div>
                  {interestsData.livesOnCampus === 'Yes' && (
                    <input
                      type="text"
                      value={interestsData.hall}
                      onChange={(e) => setInterestsData({ ...interestsData, hall: e.target.value })}
                      placeholder="Hall name"
                      className="mt-2 w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                    />
                  )}
                </div>

                {/* Demographics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Race</label>
                    <select
                      value={interestsData.race}
                      onChange={(e) => setInterestsData({ ...interestsData, race: e.target.value, raceOther: '' })}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                    >
                      <option value="">Select race</option>
                      {RACES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    {interestsData.race === 'Other/Multiple' && (
                      <input
                        type="text"
                        value={interestsData.raceOther}
                        onChange={(e) => setInterestsData({ ...interestsData, raceOther: e.target.value })}
                        placeholder="Specify"
                        className="mt-2 w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Gender</label>
                    <select
                      value={interestsData.gender}
                      onChange={(e) => setInterestsData({ ...interestsData, gender: e.target.value, genderOther: '' })}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                    >
                      <option value="">Select gender</option>
                      {GENDERS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                    {interestsData.gender === 'Other' && (
                      <input
                        type="text"
                        value={interestsData.genderOther}
                        onChange={(e) => setInterestsData({ ...interestsData, genderOther: e.target.value })}
                        placeholder="Specify"
                        className="mt-2 w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Sexuality</label>
                    <select
                      value={interestsData.sexuality}
                      onChange={(e) => setInterestsData({ ...interestsData, sexuality: e.target.value, sexualityOther: '' })}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                    >
                      <option value="">Select sexuality</option>
                      {SEXUALITIES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {interestsData.sexuality === 'Other' && (
                      <input
                        type="text"
                        value={interestsData.sexualityOther}
                        onChange={(e) => setInterestsData({ ...interestsData, sexualityOther: e.target.value })}
                        placeholder="Specify"
                        className="mt-2 w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                      />
                    )}
                  </div>
                </div>

                {/* Activities */}
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Activities of Interest</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {ACTIVITIES.map((activity) => (
                      <label key={activity} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={interestsData.activities.includes(activity)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setInterestsData({
                                ...interestsData,
                                activities: [...interestsData.activities, activity]
                              })
                            } else {
                              setInterestsData({
                                ...interestsData,
                                activities: interestsData.activities.filter(a => a !== activity)
                              })
                            }
                          }}
                          className="w-4 h-4 text-tamu-maroon border-gray-300 rounded focus:ring-tamu-maroon"
                        />
                        <span className="text-sm text-gray-700">{activity}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Hobbies */}
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Hobbies</label>
                  <textarea
                    value={interestsData.hobbies}
                    onChange={(e) => setInterestsData({ ...interestsData, hobbies: e.target.value })}
                    placeholder="Describe your hobbies and interests"
                    rows={3}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                  />
                </div>

                {/* Religious Organizations */}
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Interested in Religious Organizations?</label>
                  <div className="flex gap-4 mb-2">
                    {['Yes', 'No'].map((option) => (
                      <label key={option} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="interestedInReligiousOrgs"
                          value={option}
                          checked={interestsData.interestedInReligiousOrgs === option}
                          onChange={(e) => setInterestsData({ ...interestsData, interestedInReligiousOrgs: e.target.value, religion: '', religionOther: '' })}
                          className="w-4 h-4 text-tamu-maroon border-gray-300 focus:ring-tamu-maroon"
                        />
                        <span className="text-gray-700">{option}</span>
                      </label>
                    ))}
                  </div>
                  {interestsData.interestedInReligiousOrgs === 'Yes' && (
                    <div>
                      <select
                        value={interestsData.religion}
                        onChange={(e) => setInterestsData({ ...interestsData, religion: e.target.value, religionOther: '' })}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                      >
                        <option value="">Select religion</option>
                        {RELIGIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      {interestsData.religion === 'Other' && (
                        <input
                          type="text"
                          value={interestsData.religionOther}
                          onChange={(e) => setInterestsData({ ...interestsData, religionOther: e.target.value })}
                          placeholder="Specify"
                          className="mt-2 w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Interests Action Buttons */}
                <div className="flex gap-4 pt-4 border-t">
                  <motion.button
                    onClick={handleSaveInterests}
                    disabled={savingInterests}
                    whileHover={{ scale: savingInterests ? 1 : 1.02 }}
                    whileTap={{ scale: savingInterests ? 1 : 0.98 }}
                    className="flex-1 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingInterests ? 'Saving...' : 'Save Interests'}
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      setEditingInterests(false)
                      // Reload interests from profile
                      if (profile?.demographics) {
                        setInterestsData({
                          careerFields: profile.demographics.careerFields || [],
                          engineeringTypes: profile.demographics.engineeringTypes || [],
                          livesOnCampus: profile.demographics.livesOnCampus || '',
                          hall: profile.demographics.hall || '',
                          classification: profile.demographics.classification || '',
                          race: profile.demographics.race || '',
                          raceOther: profile.demographics.raceOther || '',
                          sexuality: profile.demographics.sexuality || '',
                          sexualityOther: profile.demographics.sexualityOther || '',
                          gender: profile.demographics.gender || '',
                          genderOther: profile.demographics.genderOther || '',
                          hobbies: profile.demographics.hobbies || '',
                          additionalHobbies: profile.demographics.additionalHobbies || [],
                          activities: profile.demographics.activities || [],
                          interestedInReligiousOrgs: profile.demographics.interestedInReligiousOrgs || '',
                          religion: profile.demographics.religion || '',
                          religionOther: profile.demographics.religionOther || ''
                        })
                      }
                      setError('')
                    }}
                    disabled={savingInterests}
                    whileHover={{ scale: savingInterests ? 1 : 1.02 }}
                    whileTap={{ scale: savingInterests ? 1 : 0.98 }}
                    className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-6">
                {profile?.demographics ? (
                  <div className="space-y-2 text-gray-700">
                    <p><span className="font-medium">Career Fields:</span> {interestsData.careerFields.length > 0 ? interestsData.careerFields.join(', ') : 'Not set'}</p>
                    {interestsData.engineeringTypes.length > 0 && (
                      <p><span className="font-medium">Engineering Types:</span> {interestsData.engineeringTypes.join(', ')}</p>
                    )}
                    <p><span className="font-medium">Classification:</span> {interestsData.classification || 'Not set'}</p>
                    <p><span className="font-medium">Lives on Campus:</span> {interestsData.livesOnCampus || 'Not set'}</p>
                    {interestsData.hall && <p><span className="font-medium">Hall:</span> {interestsData.hall}</p>}
                    <p><span className="font-medium">Race:</span> {interestsData.race || 'Not set'}{interestsData.raceOther && ` (${interestsData.raceOther})`}</p>
                    <p><span className="font-medium">Gender:</span> {interestsData.gender || 'Not set'}{interestsData.genderOther && ` (${interestsData.genderOther})`}</p>
                    <p><span className="font-medium">Sexuality:</span> {interestsData.sexuality || 'Not set'}{interestsData.sexualityOther && ` (${interestsData.sexualityOther})`}</p>
                    <p><span className="font-medium">Activities:</span> {interestsData.activities.length > 0 ? interestsData.activities.join(', ') : 'Not set'}</p>
                    {interestsData.hobbies && <p><span className="font-medium">Hobbies:</span> {interestsData.hobbies}</p>}
                    {interestsData.interestedInReligiousOrgs === 'Yes' && (
                      <p><span className="font-medium">Religion:</span> {interestsData.religion || 'Not set'}{interestsData.religionOther && ` (${interestsData.religionOther})`}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">No interests saved yet. Click &quot;Edit Interests&quot; to add your information.</p>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {editing && (
            <div className="flex gap-4 pt-4 border-t">
              <motion.button
                onClick={handleSave}
                disabled={saving}
                whileHover={{ scale: saving ? 1 : 1.02 }}
                whileTap={{ scale: saving ? 1 : 0.98 }}
                className="flex-1 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </motion.button>
              <motion.button
                onClick={() => {
                  setEditing(false)
                  setFormData({
                    name: profile?.name || '',
                    emailPreferences: profile?.emailPreferences || {
                      marketing: true,
                      updates: true,
                      recommendations: true
                    }
                  })
                  setError('')
                }}
                disabled={saving}
                whileHover={{ scale: saving ? 1 : 1.02 }}
                whileTap={{ scale: saving ? 1 : 0.98 }}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

