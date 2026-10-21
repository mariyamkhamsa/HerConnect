import React, { useEffect, useState } from 'react'
import api from '../api.js'
import { externalPhotoUrl, firstEmailLetter } from '../utils/avatar.js'

// Initial letters already fetched for other people's avatars (key: "role:profileId").
const initialCache = new Map()

// Shows, in order: the profile photo (uploaded or external https URL) -> the first letter of the
// account email, uppercased -> 'U'.
//  * `email`: pass the account email when it is known (own avatar) - no request needed.
//  * otherwise the letter is fetched from the profile's avatar-initial endpoint (same access rules as the photo).
export default function ProfileAvatar({ role, profileId, hasPhoto, photoPath, email, size = 72, className, style = {} }) {
  const [fetchedSrc, setFetchedSrc] = useState('')
  const [failedSrc, setFailedSrc] = useState('')
  const [settledKey, setSettledKey] = useState('')
  const [remote, setRemote] = useState({ key: '', letter: '' })
  const externalUrl = externalPhotoUrl(photoPath)

  const willFetchPhoto = !externalUrl && !!hasPhoto && !!profileId && !!role
  const photoKey = `${role}:${profileId}:${photoPath || ''}:${hasPhoto ? 1 : 0}`
  const photoSettled = !willFetchPhoto || settledKey === photoKey

  useEffect(() => {
    let active = true; let objectUrl = ''
    setFetchedSrc('')
    if (!willFetchPhoto) return undefined
    const endpoint = role === 'worker' ? `/workers/${profileId}/photo` : `/entrepreneurs/${profileId}/photo`
    api.get(endpoint, { responseType: 'blob' }).then(async (response) => {
      if (!active) return
      const blob = response.data
      if (blob.type && blob.type.includes('json')) {
        // Endpoint answered {"url": "https://..."} for an external photo (after its access check).
        const url = externalPhotoUrl(JSON.parse(await blob.text()).url)
        if (active && url) setFetchedSrc(url)
        return
      }
      objectUrl = URL.createObjectURL(blob); setFetchedSrc(objectUrl)
    }).catch(() => {}).finally(() => { if (active) setSettledKey(photoKey) })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [role, profileId, hasPhoto, photoPath, externalUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const candidate = externalUrl || fetchedSrc
  const displaySrc = candidate && candidate !== failedSrc ? candidate : ''   // broken image -> initial

  const ownLetter = firstEmailLetter(email)
  const initialKey = `${role}:${profileId}`
  const needRemote = !displaySrc && photoSettled && !ownLetter && !!profileId && !!role
  const remoteKnown = initialCache.has(initialKey)

  useEffect(() => {
    if (!needRemote || remoteKnown) return undefined
    let active = true
    const endpoint = role === 'worker' ? `/workers/${profileId}/avatar-initial` : `/entrepreneurs/${profileId}/avatar-initial`
    api.get(endpoint).then((res) => {
      const letter = firstEmailLetter(res.data?.initial) || 'U'
      initialCache.set(initialKey, letter)
      if (active) setRemote({ key: initialKey, letter })
    }).catch(() => { if (active) setRemote({ key: initialKey, letter: 'U' }) })   // not cached: may be retried later
    return () => { active = false }
  }, [needRemote, remoteKnown, initialKey, role, profileId])

  const remoteLetter = initialCache.get(initialKey) || (remote.key === initialKey ? remote.letter : '')
  // Keep the circle blank while a photo or the letter is still loading, rather than flashing a wrong letter.
  const photoPending = willFetchPhoto && !photoSettled
  const letter = photoPending ? '' : (ownLetter || (needRemote ? remoteLetter : 'U'))

  return <div className={className} style={{ width: size, height: size, minWidth: size, borderRadius: '50%', overflow: 'hidden', display: 'grid', placeItems: 'center', background: '#f8e4eb', color: '#b56782', border: '1px solid #f1d2dc', fontSize: Math.max(18, size * .38), fontWeight: 600, ...style }}>
    {displaySrc
      ? <img src={displaySrc} alt="Profile" referrerPolicy="no-referrer" onError={() => setFailedSrc(displaySrc)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : <span aria-hidden="true">{letter}</span>}
  </div>
}
