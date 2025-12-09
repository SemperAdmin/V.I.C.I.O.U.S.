import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { Save, FileJson, ArrowLeft, RefreshCw, Eye, GitBranch } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { githubService } from '@/services/githubService'
import { FileItem } from '@/types'
import HeaderTools from '@/components/HeaderTools'

export default function FileEditor() {
  const { owner, repo, path = '' } = useParams<{ owner: string; repo: string; path?: string }>()
  const navigate = useNavigate()
  const { getToken } = useAuthStore()
  
  const [fileContent, setFileContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [fileSha, setFileSha] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [currentPath, setCurrentPath] = useState(path)

  useEffect(() => {
    const loadFile = async () => {
      try {
        const token = getToken()
        if (!token || !owner || !repo) {
          navigate('/dashboard')
          return
        }

        const fileData = await githubService.getFileContent(token, owner, repo, currentPath)
        const decodedContent = fileData.content ? atob(fileData.content) : ''
        
        setFileContent(decodedContent)
        setOriginalContent(decodedContent)
        setFileSha(fileData.sha)
      } catch (error) {
        console.error('Error loading file:', error)
        // If file doesn't exist, start with empty JSON
        if (currentPath.endsWith('.json')) {
          setFileContent('{}')
          setOriginalContent('{}')
        }
      } finally {
        setLoading(false)
      }
    }

    loadFile()
  }, [owner, repo, currentPath, getToken, navigate])

  const handleSave = async () => {
    if (!owner || !repo || !currentPath) return

    try {
      setSaving(true)
      const token = getToken()
      if (!token) return

      // Validate JSON
      try {
        JSON.parse(fileContent)
      } catch (error) {
        alert('Invalid JSON format. Please fix the syntax errors.')
        return
      }

      const commitMessage = prompt('Enter commit message:', `Update ${currentPath.split('/').pop()}`)
      if (!commitMessage) return

      await githubService.updateFile(
        token,
        owner,
        repo,
        currentPath,
        fileContent,
        commitMessage,
        fileSha
      )

      setOriginalContent(fileContent)
      alert('File saved successfully!')
    } catch (error) {
      console.error('Error saving file:', error)
      alert('Error saving file. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleHistory = () => {
    navigate(`/history/${owner}/${repo}/${currentPath}`)
  }

  const hasChanges = fileContent !== originalContent

  if (loading) {
    return (
      <div className="min-h-screen bg-github-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-github-blue mb-4"></div>
          <p className="text-gray-400">Loading file...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-github-dark">
      {/* Header */}
      <header className="bg-github-gray bg-opacity-10 border-b border-github-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-gray-400 hover:text-white transition-colors mr-3"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <FileJson className="w-6 h-6 text-github-blue mr-3" />
              <div>
                <h1 className="text-lg font-semibold text-white">{currentPath.split('/').pop()}</h1>
                <p className="text-sm text-gray-400">{owner}/{repo}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleHistory}
                className="flex items-center px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                <GitBranch className="w-4 h-4 mr-2" />
                History
              </button>
              
              <button
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                  isPreviewMode 
                    ? 'bg-github-blue text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </button>
              
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                  hasChanges && !saving
                    ? 'bg-github-blue hover:bg-blue-600 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
            <HeaderTools />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isPreviewMode ? (
          <div className="bg-github-gray bg-opacity-10 border border-github-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">JSON Preview</h3>
            <pre className="text-sm text-gray-300 overflow-auto">
              {JSON.stringify(JSON.parse(fileContent), null, 2)}
            </pre>
          </div>
        ) : (
          <div className="bg-github-gray bg-opacity-10 border border-github-border rounded-xl overflow-hidden">
            <Editor
              height="600px"
              defaultLanguage="json"
              value={fileContent}
              onChange={(value) => setFileContent(value || '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                formatOnPaste: true,
                formatOnType: true,
              }}
            />
          </div>
        )}
        
        {hasChanges && (
          <div className="mt-4 p-4 bg-yellow-600 bg-opacity-20 border border-yellow-600 rounded-lg">
            <p className="text-yellow-400 text-sm">
              ⚠️ You have unsaved changes. Don't forget to save your work!
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
