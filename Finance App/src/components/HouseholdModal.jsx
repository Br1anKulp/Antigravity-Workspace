import { useState, useEffect } from 'react'
import { Users, Copy, Check, RefreshCw, X, Shield, Clock, AlertCircle } from 'lucide-react'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export default function HouseholdModal({ user, householdId, householdData, onClose, onHouseholdUpdated }) {
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [currentHousehold, setCurrentHousehold] = useState(householdData)
  const [now, setNow] = useState(() => Date.now())

  const userEmail = user?.email?.toLowerCase() || ''

  // Refresh household data on open
  useEffect(() => {
    let isMounted = true
    const fetchLatest = async () => {
      if (!householdId) return
      try {
        const snap = await getDoc(doc(db, 'households', householdId))
        if (snap.exists() && isMounted) {
          setCurrentHousehold(snap.data())
        }
      } catch (err) {
        console.error('Error fetching household data:', err)
      }
    }
    fetchLatest()
    return () => { isMounted = false }
  }, [householdId])

  // Countdown timer for active join code
  useEffect(() => {
    if (!currentHousehold?.joinCode || !currentHousehold?.joinCodeExpiresAt) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [currentHousehold?.joinCode, currentHousehold?.joinCodeExpiresAt])

  const timeLeft = (() => {
    const expiresAtStr = currentHousehold?.joinCodeExpiresAt
    if (!expiresAtStr || !currentHousehold?.joinCode) return ''
    const expires = new Date(expiresAtStr).getTime()
    const diff = Math.max(0, Math.floor((expires - now) / 1000))
    if (diff <= 0) return 'Expired'
    const mins = Math.floor(diff / 60)
    const secs = diff % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  })()

  const handleCopyCode = (code) => {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleGenerateCode = async () => {
    if (!householdId) return
    setGenerating(true)
    try {
      const newCode = generateJoinCode()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

      const hhRef = doc(db, 'households', householdId)
      await updateDoc(hhRef, {
        joinCode: newCode,
        joinCodeExpiresAt: expiresAt
      })

      const updated = {
        ...currentHousehold,
        joinCode: newCode,
        joinCodeExpiresAt: expiresAt
      }
      setCurrentHousehold(updated)
      if (onHouseholdUpdated) onHouseholdUpdated(updated)
    } catch (err) {
      console.error('Error generating join code:', err)
      alert('Failed to generate join code.')
    } finally {
      setGenerating(false)
    }
  }

  const isCodeActive = currentHousehold?.joinCode && timeLeft && timeLeft !== 'Expired'

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '480px',
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        animation: 'fadeIn 0.2s ease-out',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'var(--primary-bg)', color: 'var(--primary)', padding: '8px', borderRadius: '10px' }}>
              <Users size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>
                {currentHousehold?.name || 'Household Settings'}
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                ID: {householdId}
              </span>
            </div>
          </div>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={onClose}
            style={{ padding: '6px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Join Code / Invite Section */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} style={{ color: 'var(--primary)' }} /> Invite Family Member
            </span>
            {isCodeActive && (
              <span style={{ fontSize: '0.8rem', color: 'var(--warning)', fontWeight: '600' }}>
                ⏱ Expires in {timeLeft}
              </span>
            )}
          </div>

          <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            Generate a single-use 6-character code that your family member can enter when signing up. Codes expire after 5 minutes.
          </p>

          {isCodeActive ? (
            <div style={{
              background: 'var(--primary-bg)',
              border: '1px dashed var(--primary)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Active Join Code:</span>
                <span style={{
                  fontSize: '1.8rem',
                  fontWeight: '800',
                  letterSpacing: '4px',
                  color: 'var(--primary)',
                  fontFamily: 'var(--font-heading)'
                }}>
                  {currentHousehold.joinCode}
                </span>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => handleCopyCode(currentHousehold.joinCode)}
                style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy Code</>}
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleGenerateCode}
              disabled={generating}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <RefreshCw size={16} className={generating ? 'spin-animation' : ''} />
              {generating ? 'Generating Code...' : 'Generate New 5-Minute Join Code'}
            </button>
          )}

          {isCodeActive && (
            <button
              className="btn btn-ghost"
              onClick={handleGenerateCode}
              disabled={generating}
              style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
            >
              Regenerate New Code
            </button>
          )}
        </div>

        {/* Members List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>
            Household Members ({currentHousehold?.members?.length || 1})
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(currentHousehold?.members || [userEmail]).map((memberEmail) => {
              const isMemberAdmin = currentHousehold?.adminEmail 
                ? currentHousehold.adminEmail.toLowerCase() === memberEmail.toLowerCase()
                : memberEmail.toLowerCase() === userEmail
              const isPrimaryPlaid = currentHousehold?.primaryPlaidUser?.toLowerCase() === memberEmail.toLowerCase()

              return (
                <div key={memberEmail} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'var(--bg-surface)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '0.88rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <span style={{
                      fontWeight: '500',
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {memberEmail}
                    </span>
                    {memberEmail.toLowerCase() === userEmail && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>(You)</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {isMemberAdmin && (
                      <span style={{
                        fontSize: '0.72rem',
                        background: 'var(--primary-bg)',
                        color: 'var(--primary)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        <Shield size={10} /> Admin
                      </span>
                    )}
                    {isPrimaryPlaid && (
                      <span style={{
                        fontSize: '0.72rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-secondary)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        border: '1px solid var(--border)'
                      }}>
                        Bank Owner
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer info */}
        <div style={{
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          borderTop: '1px solid var(--border)',
          paddingTop: '14px'
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>All members in this household share the same budgets, transactions, and connected bank feed.</span>
        </div>
      </div>
    </div>
  )
}
