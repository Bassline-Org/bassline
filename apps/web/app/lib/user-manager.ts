/**
 * User Profile Management
 * 
 * Manages user profiles as basslines stored in localStorage
 */

import type { Bassline } from '@bassline/bassline'types'

export interface UserProfile extends Bassline {
  name: string  // @username format
  attributes: {
    'bassline.type': 'user-profile'
    'bassline.mutable': boolean
    [key: string]: any
  }
}

export class UserManager {
  private static STORAGE_KEY = 'bassline-current-user-profile'
  private static instance: UserManager
  
  static getInstance(): UserManager {
    if (!UserManager.instance) {
      UserManager.instance = new UserManager()
    }
    return UserManager.instance
  }
  
  /**
   * Get the current user profile from localStorage
   */
  getCurrentUser(): UserProfile | null {
    if (typeof window === 'undefined') return null
    
    try {
      const stored = localStorage.getItem(UserManager.STORAGE_KEY)
      if (!stored) return null
      
      const profile = JSON.parse(stored)
      // Validate it's a user profile
      if (profile?.attributes?.['bassline.type'] !== 'user-profile') {
        console.warn('Invalid user profile in storage')
        return null
      }
      
      return profile as UserProfile
    } catch (error) {
      console.error('Failed to load user profile:', error)
      return null
    }
  }
  
  /**
   * Set the current user profile
   */
  setCurrentUser(profile: UserProfile): void {
    if (typeof window === 'undefined') return
    
    try {
      // Ensure it's marked as a user profile
      profile.attributes = {
        ...profile.attributes,
        'bassline.type': 'user-profile',
        'bassline.mutable': true
      }
      
      localStorage.setItem(UserManager.STORAGE_KEY, JSON.stringify(profile))
      
      // Dispatch event for other components to react
      window.dispatchEvent(new CustomEvent('user-profile-changed', {
        detail: profile
      }))
    } catch (error) {
      console.error('Failed to save user profile:', error)
    }
  }
  
  /**
   * Create a new user profile bassline
   */
  createNewUser(username: string, data?: {
    displayName?: string
    bio?: string
    avatar?: string
    website?: string
    github?: string
    twitter?: string
  }): UserProfile {
    // Clean username (remove @ if provided, add it back)
    const cleanUsername = username.startsWith('@') ? username : `@${username}`
    
    return {
      name: cleanUsername,
      description: `User profile for ${data?.displayName || username}`,
      attributes: {
        'bassline.type': 'user-profile',
        'bassline.mutable': true
      },
      build: {
        topology: {
          contacts: [
            {
              id: 'displayName',
              content: data?.displayName || username,
              blendMode: 'accept-last'
            },
            {
              id: 'bio',
              content: data?.bio || '',
              blendMode: 'accept-last'
            },
            {
              id: 'avatar',
              content: data?.avatar || '',
              blendMode: 'accept-last'
            },
            {
              id: 'website',
              content: data?.website || '',
              blendMode: 'accept-last'
            },
            {
              id: 'github',
              content: data?.github || '',
              blendMode: 'accept-last'
            },
            {
              id: 'twitter',
              content: data?.twitter || '',
              blendMode: 'accept-last'
            },
            {
              id: 'joined',
              content: new Date().toISOString(),
              blendMode: 'accept-last'
            },
            {
              id: 'authored',
              content: [],  // Array of bassline names/IDs
              blendMode: 'merge'
            },
            {
              id: 'starred',
              content: [],  // Array of starred basslines
              blendMode: 'merge'
            }
          ],
          wires: []
        }
      },
      metadata: {
        created: new Date().toISOString(),
        modified: new Date().toISOString()
      }
    }
  }
  
  /**
   * Update specific profile fields
   */
  updateProfile(updates: Partial<{
    displayName: string
    bio: string
    avatar: string
    website: string
    github: string
    twitter: string
  }>): UserProfile | null {
    const current = this.getCurrentUser()
    if (!current) return null
    
    // Find and update the relevant contacts
    if (current.build?.topology?.contacts) {
      for (const [key, value] of Object.entries(updates)) {
        const contact = current.build.topology.contacts.find(c => c.id === key)
        if (contact) {
          contact.content = value
        }
      }
    }
    
    // Update modified timestamp
    if (current.metadata) {
      current.metadata.modified = new Date().toISOString()
    }
    
    this.setCurrentUser(current)
    return current
  }
  
  /**
   * Add an authored bassline to the user's profile
   */
  addAuthoredBassline(basslineName: string): void {
    const current = this.getCurrentUser()
    if (!current) return
    
    const authoredContact = current.build?.topology?.contacts?.find(
      c => c.id === 'authored'
    )
    
    if (authoredContact) {
      const authored = Array.isArray(authoredContact.content) 
        ? authoredContact.content 
        : []
      
      if (!authored.includes(basslineName)) {
        authoredContact.content = [...authored, basslineName]
        this.setCurrentUser(current)
      }
    }
  }
  
  /**
   * Get profile data as a simple object
   */
  getProfileData(profile: UserProfile): {
    username: string
    displayName: string
    bio: string
    avatar: string
    website: string
    github: string
    twitter: string
    joined: string
    authored: string[]
    starred: string[]
  } {
    const contacts = profile.build?.topology?.contacts || []
    const getContactValue = (id: string, defaultValue: any = '') => {
      const contact = contacts.find(c => c.id === id)
      return contact?.content || defaultValue
    }
    
    return {
      username: profile.name,
      displayName: getContactValue('displayName'),
      bio: getContactValue('bio'),
      avatar: getContactValue('avatar'),
      website: getContactValue('website'),
      github: getContactValue('github'),
      twitter: getContactValue('twitter'),
      joined: getContactValue('joined'),
      authored: getContactValue('authored', []),
      starred: getContactValue('starred', [])
    }
  }
  
  /**
   * Clear the current user (logout)
   */
  clearCurrentUser(): void {
    if (typeof window === 'undefined') return
    
    localStorage.removeItem(UserManager.STORAGE_KEY)
    window.dispatchEvent(new CustomEvent('user-profile-changed', {
      detail: null
    }))
  }
}

// Export singleton instance
export const userManager = UserManager.getInstance()