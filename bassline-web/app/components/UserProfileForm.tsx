import { useState, useEffect } from 'react'
import { User, Globe, Github, Twitter, Save, Download, Upload } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { useCurrentUser } from '~/hooks/useCurrentUser'
import { useSoundToast } from '~/hooks/useSoundToast'
import { serializeBassline, deserializeBassline } from '~/propagation-core-v2/bassline'
import type { UserProfile } from '~/lib/user-manager'

interface UserProfileFormProps {
  onClose?: () => void
  isNewUser?: boolean
}

export function UserProfileForm({ onClose, isNewUser = false }: UserProfileFormProps) {
  const { user, profileData, createUser, updateProfile } = useCurrentUser()
  const toast = useSoundToast()
  
  // Form state
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState('')
  const [website, setWebsite] = useState('')
  const [github, setGithub] = useState('')
  const [twitter, setTwitter] = useState('')
  
  // Load existing profile data
  useEffect(() => {
    if (profileData) {
      setUsername(profileData.username.replace('@', ''))
      setDisplayName(profileData.displayName)
      setBio(profileData.bio)
      setAvatar(profileData.avatar)
      setWebsite(profileData.website)
      setGithub(profileData.github)
      setTwitter(profileData.twitter)
    }
  }, [profileData])
  
  const handleSave = () => {
    if (isNewUser) {
      if (!username.trim()) {
        toast.error('Username is required')
        return
      }
      
      createUser(username, {
        displayName: displayName || username,
        bio,
        avatar,
        website,
        github,
        twitter
      })
      
      toast.success('Profile created!')
    } else {
      updateProfile({
        displayName,
        bio,
        avatar,
        website,
        github,
        twitter
      })
      
      toast.success('Profile updated!')
    }
    
    onClose?.()
  }
  
  const handleExport = () => {
    if (!user) return
    
    const json = serializeBassline(user)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${user.name.replace('@', '')}-profile.bassline.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Profile exported!')
  }
  
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    try {
      const text = await file.text()
      const profile = deserializeBassline(text) as UserProfile
      
      // Validate it's a user profile
      if (profile.attributes?.['bassline.type'] !== 'user-profile') {
        toast.error('Invalid user profile file')
        return
      }
      
      // Load the profile data into the form
      const data = profileData || {
        username: profile.name,
        displayName: '',
        bio: '',
        avatar: '',
        website: '',
        github: '',
        twitter: '',
        joined: '',
        authored: [],
        starred: []
      }
      
      if (profile.build?.topology?.contacts) {
        const contacts = profile.build.topology.contacts
        const getContact = (id: string) => contacts.find(c => c.id === id)?.content || ''
        
        setUsername(profile.name.replace('@', ''))
        setDisplayName(String(getContact('displayName') || data.displayName))
        setBio(String(getContact('bio') || data.bio))
        setAvatar(String(getContact('avatar') || data.avatar))
        setWebsite(String(getContact('website') || data.website))
        setGithub(String(getContact('github') || data.github))
        setTwitter(String(getContact('twitter') || data.twitter))
      }
      
      toast.success('Profile imported! Click Save to apply.')
    } catch (error) {
      console.error('Import failed:', error)
      toast.error('Failed to import profile')
    }
  }
  
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>{isNewUser ? 'Create Your Profile' : 'Edit Profile'}</CardTitle>
        <CardDescription>
          {isNewUser 
            ? 'Set up your user profile to identify your basslines'
            : 'Update your profile information'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Username (only editable for new users) */}
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="username"
              placeholder="alice"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={!isNewUser}
              className="pl-9"
            />
          </div>
          {!isNewUser && (
            <p className="text-xs text-muted-foreground">
              @{username} (cannot be changed)
            </p>
          )}
        </div>
        
        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            placeholder="Alice Smith"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        
        {/* Bio */}
        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <textarea
            id="bio"
            placeholder="Tell us about yourself..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        
        {/* Avatar URL */}
        <div className="space-y-2">
          <Label htmlFor="avatar">Avatar URL</Label>
          <Input
            id="avatar"
            type="url"
            placeholder="https://example.com/avatar.jpg"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
          />
          {avatar && (
            <img 
              src={avatar} 
              alt="Avatar preview" 
              className="h-16 w-16 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          )}
        </div>
        
        {/* Website */}
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="website"
              type="url"
              placeholder="https://alice.dev"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        {/* GitHub */}
        <div className="space-y-2">
          <Label htmlFor="github">GitHub</Label>
          <div className="relative">
            <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="github"
              placeholder="alicesmith"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        {/* Twitter */}
        <div className="space-y-2">
          <Label htmlFor="twitter">Twitter</Label>
          <div className="relative">
            <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="twitter"
              placeholder="@alicesmith"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button onClick={handleSave} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            Save Profile
          </Button>
          
          {!isNewUser && (
            <>
              <Button onClick={handleExport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              
              <div className="relative">
                <input
                  type="file"
                  accept=".json,.bassline"
                  onChange={handleImport}
                  className="hidden"
                  id="profile-import"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('profile-import')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
              </div>
            </>
          )}
          
          {onClose && !isNewUser && (
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          )}
        </div>
        
        {/* Profile metadata */}
        {profileData && !isNewUser && (
          <div className="text-xs text-muted-foreground pt-4 border-t">
            <p>Joined: {new Date(profileData.joined).toLocaleDateString()}</p>
            <p>Authored: {profileData.authored.length} basslines</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}