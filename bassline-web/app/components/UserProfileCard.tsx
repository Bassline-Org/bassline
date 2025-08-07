import { Globe, Github, Twitter, Calendar, Package, Star } from 'lucide-react'
import { Card, CardContent, CardHeader } from './ui/card'
import { Badge } from './ui/badge'
import type { UserProfile } from '~/lib/user-manager'
import { userManager } from '~/lib/user-manager'

interface UserProfileCardProps {
  profile: UserProfile
  variant?: 'full' | 'compact'
  showActions?: boolean
  onViewBasslines?: () => void
}

export function UserProfileCard({ 
  profile, 
  variant = 'full',
  showActions = false,
  onViewBasslines
}: UserProfileCardProps) {
  const data = userManager.getProfileData(profile)
  
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 p-3">
        {/* Avatar */}
        {data.avatar ? (
          <img 
            src={data.avatar} 
            alt={data.displayName}
            className="h-10 w-10 rounded-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.displayName)}&background=random`
            }}
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
            {data.displayName[0]?.toUpperCase()}
          </div>
        )}
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{data.displayName}</div>
          <div className="text-sm text-muted-foreground truncate">{data.username}</div>
        </div>
        
        {/* Stats */}
        {data.authored.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {data.authored.length} basslines
          </Badge>
        )}
      </div>
    )
  }
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          {data.avatar ? (
            <img 
              src={data.avatar} 
              alt={data.displayName}
              className="h-20 w-20 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.displayName)}&background=random`
              }}
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold">
              {data.displayName[0]?.toUpperCase()}
            </div>
          )}
          
          {/* Main Info */}
          <div className="flex-1">
            <h3 className="text-xl font-semibold">{data.displayName}</h3>
            <p className="text-muted-foreground">{data.username}</p>
            {data.bio && (
              <p className="text-sm mt-2">{data.bio}</p>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Links */}
        <div className="flex flex-wrap gap-3">
          {data.website && (
            <a 
              href={data.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Globe className="h-4 w-4" />
              Website
            </a>
          )}
          
          {data.github && (
            <a 
              href={`https://github.com/${data.github}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-4 w-4" />
              {data.github}
            </a>
          )}
          
          {data.twitter && (
            <a 
              href={`https://twitter.com/${data.twitter.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Twitter className="h-4 w-4" />
              {data.twitter}
            </a>
          )}
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Package className="h-4 w-4" />
              Authored
            </div>
            <div className="text-2xl font-semibold">{data.authored.length}</div>
          </div>
          
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Star className="h-4 w-4" />
              Starred
            </div>
            <div className="text-2xl font-semibold">{data.starred.length}</div>
          </div>
          
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              Joined
            </div>
            <div className="text-sm font-medium">
              {new Date(data.joined).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric'
              })}
            </div>
          </div>
        </div>
        
        {/* Recent Basslines */}
        {data.authored.length > 0 && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Recent Basslines</h4>
            <div className="space-y-1">
              {data.authored.slice(0, 3).map((name) => (
                <div key={name} className="text-sm text-muted-foreground">
                  • {name}
                </div>
              ))}
              {data.authored.length > 3 && (
                <button 
                  onClick={onViewBasslines}
                  className="text-sm text-blue-500 hover:underline"
                >
                  View all {data.authored.length} basslines →
                </button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}