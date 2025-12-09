import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, User, RotateCcw, ExternalLink } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { githubService } from '@/services/githubService'
import { Commit } from '@/types'
import HeaderTools from '@/components/HeaderTools'

export default function HistoryView() {
  const { owner, repo, path = '' } = useParams<{ owner: string; repo: string; path?: string }>()
  const navigate = useNavigate()
  const { getToken } = useAuthStore()
  
  const [commits, setCommits] = useState<Commit[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null)

  useEffect(() => {
    const loadCommits = async () => {
      try {
        const token = getToken()
        if (!token || !owner || !repo) {
          navigate('/dashboard')
          return
        }

        const commitHistory = await githubService.getFileCommits(token, owner, repo, path)
        setCommits(commitHistory)
      } catch (error) {
        console.error('Error loading commits:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCommits()
  }, [owner, repo, path, getToken, navigate])

  const handleRollback = async (commit: Commit) => {
    if (!confirm(`Are you sure you want to rollback to this commit?\n\n${commit.message}\nBy: ${commit.author.name}`)) {
      return
    }

    try {
      const token = getToken()
      if (!token) return

      // Get the file content at this commit
      const commitData = await githubService.getCommitDiff(token, owner!, repo!, commit.sha)
      
      // Find the file in the commit
      const fileInCommit = commitData.files?.find((file: any) => file.filename === path)
      
      if (!fileInCommit) {
        alert('Could not find file in this commit')
        return
      }

      // Get the current file info to get the SHA
      const currentFile = await githubService.getFileContent(token, owner!, repo!, path)
      
      // Update the file with the old content
      await githubService.updateFile(
        token,
        owner!,
        repo!,
        path,
        fileInCommit.previous_content || '{}',
        `Rollback to commit ${commit.sha.substring(0, 7)}: ${commit.message}`,
        currentFile.sha
      )

      alert('Rollback successful!')
      navigate(`/editor/${owner}/${repo}/${path}`)
    } catch (error) {
      console.error('Error during rollback:', error)
      alert('Error during rollback. Please try again.')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-github-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-github-blue mb-4"></div>
          <p className="text-gray-400">Loading commit history...</p>
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
                onClick={() => navigate(`/editor/${owner}/${repo}/${path}`)}
                className="p-2 text-gray-400 hover:text-white transition-colors mr-3"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-white">File History</h1>
                <p className="text-sm text-gray-400">{owner}/{repo}/{path}</p>
              </div>
            </div>
            <HeaderTools />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Commit History</h2>
          <p className="text-gray-400">View and manage changes to this file</p>
        </div>

        {/* Commit Timeline */}
        <div className="space-y-4">
          {commits.map((commit, index) => (
            <div
              key={commit.sha}
              className={`bg-github-gray bg-opacity-10 border rounded-xl p-6 transition-all duration-200 ${
                selectedCommit?.sha === commit.sha
                  ? 'border-github-blue bg-opacity-20'
                  : 'border-github-border hover:border-github-blue hover:bg-opacity-15'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-github-blue rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{commit.message}</h3>
                      <span className="px-2 py-1 text-xs bg-github-blue bg-opacity-20 text-github-blue rounded-full font-mono">
                        {commit.sha.substring(0, 7)}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                      <div className="flex items-center">
                        <User className="w-4 h-4 mr-2" />
                        <span>{commit.author.name}</span>
                      </div>
                      
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        <span>{formatDate(commit.author.date)}</span>
                      </div>
                      
                      <a
                        href={commit.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-github-blue hover:text-blue-400"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View on GitHub
                      </a>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleRollback(commit)}
                    className="flex items-center px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Rollback
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {commits.length === 0 && (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 mb-2">No commit history</h3>
            <p className="text-gray-500">This file has no commit history available.</p>
          </div>
        )}
      </main>
    </div>
  )
}
