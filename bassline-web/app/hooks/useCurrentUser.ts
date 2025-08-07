/**
 * React hook for current user profile management
 */

import { useState, useEffect, useCallback } from 'react'
import { userManager, type UserProfile } from '~/lib/user-manager'

export interface UseCurrentUserReturn {
  user: UserProfile | null
  profileData: ReturnType<typeof userManager.getProfileData> | null
  isLoading: boolean
  setUser: (profile: UserProfile) => void
  updateProfile: (updates: Parameters<typeof userManager.updateProfile>[0]) => void
  createUser: (username: string, data?: Parameters<typeof userManager.createNewUser>[1]) => UserProfile
  clearUser: () => void
  addAuthoredBassline: (name: string) => void
}

export function useCurrentUser(): UseCurrentUserReturn {
  const [user, setUserState] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Load initial user
  useEffect(() => {
    const loadUser = () => {
      const currentUser = userManager.getCurrentUser()
      setUserState(currentUser)
      setIsLoading(false)
    }
    
    loadUser()
    
    // Listen for profile changes
    const handleProfileChange = (event: CustomEvent) => {
      setUserState(event.detail)
    }
    
    window.addEventListener('user-profile-changed', handleProfileChange as EventListener)
    
    return () => {
      window.removeEventListener('user-profile-changed', handleProfileChange as EventListener)
    }
  }, [])
  
  const setUser = useCallback((profile: UserProfile) => {
    userManager.setCurrentUser(profile)
    setUserState(profile)
  }, [])
  
  const updateProfile = useCallback((updates: Parameters<typeof userManager.updateProfile>[0]) => {
    const updated = userManager.updateProfile(updates)
    if (updated) {
      setUserState(updated)
    }
  }, [])
  
  const createUser = useCallback((username: string, data?: Parameters<typeof userManager.createNewUser>[1]) => {
    const newUser = userManager.createNewUser(username, data)
    userManager.setCurrentUser(newUser)
    setUserState(newUser)
    return newUser
  }, [])
  
  const clearUser = useCallback(() => {
    userManager.clearCurrentUser()
    setUserState(null)
  }, [])
  
  const addAuthoredBassline = useCallback((name: string) => {
    userManager.addAuthoredBassline(name)
    // Reload user to get updated data
    const updated = userManager.getCurrentUser()
    setUserState(updated)
  }, [])
  
  const profileData = user ? userManager.getProfileData(user) : null
  
  return {
    user,
    profileData,
    isLoading,
    setUser,
    updateProfile,
    createUser,
    clearUser,
    addAuthoredBassline
  }
}