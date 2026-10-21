import React, { useCallback, useEffect, useState } from 'react'
import api from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import './admin.css'

const TABS = ['users', 'jobs', 'categories']

/**
 * Simple admin panel (PRD 6.3 / FR11): activate/deactivate users, remove jobs,
 * manage the fixed category list. No analytics, per PRD scope.
 */
export default function AdminPanel() {
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [jobs, setJobs] = useState([])
  const [categories, setCategories] = useState([])
  const [newCategory, setNewCategory] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [u, j, c] = await Promise.all([
        api.get('/admin/users'), api.get('/admin/jobs'), api.get('/admin/categories'),
      ])
      setUsers(u.data); setJobs(j.data); setCategories(c.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load admin data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (fn) => {
    setError('')
    try { await fn(); await load() }
    catch (err) { setError(err.response?.data?.detail || 'Action failed.') }
  }

  const toggleUser = (u) => act(() => api.put(`/admin/users/${u.id}/${u.is_active ? 'deactivate' : 'activate'}`))

  const removeJob = (job) => {
    if (!window.confirm(`Remove "${job.title}"? This also deletes its applications.`)) return
    act(() => api.delete(`/admin/jobs/${job.id}`))
  }

  const addCategory = (e) => {
    e.preventDefault()
    if (!newCategory.trim()) return
    act(async () => { await api.post('/admin/categories', { name: newCategory }); setNewCategory('') })
  }

  const saveCategory = (id) => act(async () => {
    await api.put(`/admin/categories/${id}`, { name: editingName })
    setEditingId(null)
  })

  const deleteCategory = (c) => {
    if (!window.confirm(`Delete category "${c.name}"? Jobs using it will become uncategorised.`)) return
    act(() => api.delete(`/admin/categories/${c.id}`))
  }

  return (
    <div className="page-container">
      <h2>Admin Panel</h2>
      <p>Manage users, job postings and categories.</p>

      <div className="admin-tabs">
        {TABS.map((t) => (
          <button key={t} className={`admin-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading && <div className="spinner" />}

      {!loading && tab === 'users' && (
        <Card>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>ID</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.email}</td>
                    <td><span className="badge badge-pink">{u.role}</span></td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {u.is_active ? 'active' : 'deactivated'}
                      </span>
                    </td>
                    <td>
                      {u.role !== 'admin' && (
                        <Button size="sm" variant={u.is_active ? 'danger' : 'success'} onClick={() => toggleUser(u)}>
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loading && tab === 'jobs' && (
        <Card>
          {jobs.length === 0 && <p>No job postings.</p>}
          {jobs.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Title</th><th>Business</th><th>Locality</th><th>Category</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id}>
                      <td>{j.title}</td>
                      <td>{j.business_name}</td>
                      <td>{j.locality}</td>
                      <td>{j.category || '—'}</td>
                      <td><span className={`badge ${j.status === 'open' ? 'badge-success' : 'badge-neutral'}`}>{j.status}</span></td>
                      <td><Button size="sm" variant="danger" onClick={() => removeJob(j)}>Remove</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {!loading && tab === 'categories' && (
        <Card>
          <form className="admin-inline-form" onSubmit={addCategory}>
            <input
              className="form-input" value={newCategory} maxLength={100}
              onChange={(e) => setNewCategory(e.target.value)} placeholder="New category, e.g. embroidery"
            />
            <Button type="submit" size="sm">Add category</Button>
          </form>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Name</th><th /></tr></thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {editingId === c.id
                        ? <input className="form-input" value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                        : c.name}
                    </td>
                    <td style={{ display: 'flex', gap: '8px' }}>
                      {editingId === c.id ? (
                        <>
                          <Button size="sm" onClick={() => saveCategory(c.id)}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => { setEditingId(c.id); setEditingName(c.name) }}>Rename</Button>
                          <Button size="sm" variant="danger" onClick={() => deleteCategory(c)}>Delete</Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
