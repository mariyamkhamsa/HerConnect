import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'

export default function EntrepreneurProfileForm() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ business_name: '', description: '', locality: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/entrepreneurs/me').then((res) => setForm(res.data)).catch(() => {})
  }, [])

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await api.post('/entrepreneurs/me', form)
      setSuccess('Business profile saved.')
      setTimeout(() => navigate('/entrepreneur'), 700)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save profile.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container narrow">
      <h2>Your Business Profile</h2>
      <p>This helps skilled women understand who they'd be working with.</p>
      <Card>
        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Business name</label>
            <input className="form-input" required value={form.business_name} onChange={handleChange('business_name')} placeholder="e.g. Rose Petal Bridal Boutique" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description || ''} onChange={handleChange('description')} placeholder="Tell workers a bit about your business" />
          </div>
          <div className="form-group">
            <label className="form-label">Locality</label>
            <input className="form-input" required value={form.locality} onChange={handleChange('locality')} placeholder="e.g. Kochi" />
          </div>
          <Button type="submit" block disabled={loading}>{loading ? 'Saving...' : 'Save profile'}</Button>
        </form>
      </Card>
    </div>
  )
}
