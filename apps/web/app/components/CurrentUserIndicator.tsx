import { useState, useEffect } from 'react'
import { User, Settings, LogOut, ChevronDown } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { UserProfileForm } from './UserProfileForm'
import { UserProfileCard } from './UserProfileCard'
import { useCurrentUser } from '~/hooks/useCurrentUser'

export function CurrentUserIndicator() {
  const { user, profileData, clearUser, isLoading } = useCurrentUser()
  const [showProfileForm, setShowProfileForm] = useState(false)
  const [showProfileCard, setShowProfileCard] = useState(false)
  const [showNewUserForm, setShowNewUserForm] = useState(false)
  
  // Auto-show new user form on first load if no user exists
  useEffect(() => {
    if (!isLoading && !user && !showNewUserForm) {
      // Small delay to prevent flashing
      const timer = setTimeout(() => {
        setShowNewUserForm(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isLoading, user, showNewUserForm])
  
  return (
    <>
      {/* Show Sign In button or user dropdown */}
      {!user ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowNewUserForm(true)}
          className="gap-2 animate-pulse"
        >
          <User className="h-4 w-4" />
          Sign In
        </Button>
      ) : profileData ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              {/* Avatar or initial */}
              {profileData.avatar ? (
                <img 
                  src={profileData.avatar} 
                  alt={profileData.displayName}
                  className="h-6 w-6 rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                  {profileData.displayName[0]?.toUpperCase()}
                </div>
              )}
              
              <span className="hidden sm:inline-block">{profileData.displayName}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{profileData.displayName}</p>
              <p className="text-xs text-muted-foreground">{profileData.username}</p>
            </div>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={() => setShowProfileCard(true)}>
              <User className="mr-2 h-4 w-4" />
              View Profile
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => setShowProfileForm(true)}>
              <Settings className="mr-2 h-4 w-4" />
              Edit Profile
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              onClick={() => {
                clearUser()
                setShowNewUserForm(true)
              }}
              className="text-red-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      
      {/* Profile Form Dialog */}
      <Dialog open={showProfileForm} onOpenChange={setShowProfileForm}>
        <DialogContent className="max-w-2xl p-0">
          <UserProfileForm onClose={() => setShowProfileForm(false)} />
        </DialogContent>
      </Dialog>
      
      {/* Profile Card Dialog */}
      <Dialog open={showProfileCard} onOpenChange={setShowProfileCard}>
        <DialogContent className="max-w-lg">
          {user && <UserProfileCard profile={user} />}
        </DialogContent>
      </Dialog>
      
      {/* New User Form Dialog */}
      <Dialog open={showNewUserForm} onOpenChange={setShowNewUserForm}>
        <DialogContent className="max-w-2xl p-0">
          <UserProfileForm 
            isNewUser 
            onClose={() => setShowNewUserForm(false)} 
          />
        </DialogContent>
      </Dialog>
    </>
  )
}