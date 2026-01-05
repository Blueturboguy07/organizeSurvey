import { Suspense } from 'react'
import SurveyForm from '@/components/SurveyForm'

function SurveyFormWrapper() {
  return <SurveyForm />
}

export default function SurveyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
        </div>
      }>
        <SurveyFormWrapper />
      </Suspense>
    </main>
  )
}

