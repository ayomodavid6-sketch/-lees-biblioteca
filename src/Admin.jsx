
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import './Admin.css'

const emptyBook = {
  title: '',
  isbn: '',
  description: '',
  publisher: '',
  publication_year: '',
  language: 'English',
  category_id: '',
  author_id: '',
  physical: false,
  physical_price: '',
  physical_stock: '0',
  ebook: false,
  ebook_price: ''
}

const emptyAd = {
  title: '',
  advertiser_name: '',
  description: '',
  destination_url: '',
  placement: 'homepage_spotlight',
  starts_at: '',
  ends_at: '',
  is_active: true
}

const placements = [
  { value: 'homepage_spotlight', label: 'Homepage Spotlight' },
  { value: 'featured_partner', label: 'Featured Partner' },
  { value: 'sponsored_features', label: 'Sponsored Features' }
]

function toDateTimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 16)
}

function Admin() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [admin, setAdmin] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const [section, setSection] = useState('overview')

  const [books, setBooks] = useState([])
  const [categories, setCategories] = useState([])
  const [authors, setAuthors] = useState([])
  const [advertisements, setAdvertisements] = useState([])

  const [form, setForm] = useState(emptyBook)
  const [cover, setCover] = useState(null)
  const [editingBookId, setEditingBookId] = useState(null)

  const [authorForm, setAuthorForm] = useState({
    full_name: '',
    biography: ''
  })

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: ''
  })

  const [adForm, setAdForm] = useState(emptyAd)
  const [adImage, setAdImage] = useState(null)
  const [editingAdId, setEditingAdId] = useState(null)

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function checkUser(currentSession) {
      if (!mounted) return

      setSession(currentSession)

      if (!currentSession) {
        setAdmin(false)
        setChecking(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentSession.user.id)
        .single()

      if (!mounted) return

      if (error || data?.role !== 'admin') {
        setAdmin(false)
        setError('This account does not have administrator access.')
      } else {
        setAdmin(true)
        setError('')
      }

      setChecking(false)
    }

    supabase.auth.getSession().then(({ data }) => {
      checkUser(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        checkUser(newSession)
      }
    )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (admin) loadDashboard()
  }, [admin])

  async function loadDashboard() {
    setError('')

    const [
      booksResult,
      categoriesResult,
      authorsResult,
      adsResult
    ] = await Promise.all([
      supabase
        .from('books')
        .select(`
          id, title, isbn, description, publisher, publication_year,
          language, cover_image_url, author_id, category_id,
          is_active, created_at,
          authors(full_name),
          categories(name),
          book_editions(id, format, price, stock_quantity)
        `)
        .order('created_at', { ascending: false }),

      supabase
        .from('categories')
        .select('id, name, description')
        .order('name'),

      supabase
        .from('authors')
        .select('id, full_name, biography')
        .order('full_name'),

      supabase
        .from('advertisements')
        .select('*')
        .order('created_at', { ascending: false })
    ])

    if (booksResult.error) setError(booksResult.error.message)
    else setBooks(booksResult.data || [])

    if (categoriesResult.error) setError(categoriesResult.error.message)
    else setCategories(categoriesResult.data || [])

    if (authorsResult.error) setError(authorsResult.error.message)
    else setAuthors(authorsResult.data || [])

    if (adsResult.error) setError(adsResult.error.message)
    else setAdvertisements(adsResult.data || [])
  }

  async function login(event) {
    event.preventDefault()
    setLoginError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) setLoginError(error.message)
  }

  async function logout() {
    await supabase.auth.signOut()
    setSection('overview')
  }

  function updateForm(event) {
    const { name, value, type, checked } = event.target

    setForm(previous => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  function updateAdForm(event) {
    const { name, value, type, checked } = event.target

    setAdForm(previous => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  function resetAdForm() {
    setAdForm(emptyAd)
    setAdImage(null)
    setEditingAdId(null)
  }

  async function addAuthor(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    const { error } = await supabase
      .from('authors')
      .insert({
        full_name: authorForm.full_name.trim(),
        biography: authorForm.biography.trim() || null
      })

    if (error) {
      setError(error.message)
    } else {
      setMessage('Author added successfully.')
      setAuthorForm({ full_name: '', biography: '' })
      await loadDashboard()
    }

    setSaving(false)
  }

  async function addCategory(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    const { error } = await supabase
      .from('categories')
      .insert({
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || null
      })

    if (error) {
      setError(error.message)
    } else {
      setMessage('Category added successfully.')
      setCategoryForm({ name: '', description: '' })
      await loadDashboard()
    }

    setSaving(false)
  }

  async function addBook(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    try {
      if (!form.physical && !form.ebook) {
        throw new Error('Select at least one book format.')
      }

      if (
        form.physical &&
        (form.physical_price === '' || Number(form.physical_price) < 0)
      ) {
        throw new Error('Enter a valid physical book price.')
      }

      if (
        form.ebook &&
        (form.ebook_price === '' || Number(form.ebook_price) < 0)
      ) {
        throw new Error('Enter a valid ebook price.')
      }

      let coverUrl = form.cover_image_url || null

      if (cover) {
        if (!cover.type.startsWith('image/')) {
          throw new Error('Please select an image file.')
        }

        if (cover.size > 5 * 1024 * 1024) {
          throw new Error('The cover image must be smaller than 5 MB.')
        }

        const safeName = cover.name.replace(/[^a-zA-Z0-9.-]/g, '-')
        const filePath = `${Date.now()}-${safeName}`

        const { error: uploadError } = await supabase.storage
          .from('book-covers')
          .upload(filePath, cover)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('book-covers')
          .getPublicUrl(filePath)

        coverUrl = urlData.publicUrl
      }

      const bookPayload = {
        title: form.title.trim(),
        isbn: form.isbn.trim() || null,
        description: form.description.trim() || null,
        publisher: form.publisher.trim() || null,
        publication_year: form.publication_year
          ? Number(form.publication_year)
          : null,
        language: form.language.trim() || 'English',
        category_id: form.category_id || null,
        author_id: form.author_id || null,
        cover_image_url: coverUrl
      }

      let bookId = editingBookId

      if (editingBookId) {
        const { error: bookError } = await supabase
          .from('books')
          .update(bookPayload)
          .eq('id', editingBookId)

        if (bookError) throw bookError
      } else {
        const { data: book, error: bookError } = await supabase
          .from('books')
          .insert({ ...bookPayload, is_active: true })
          .select()
          .single()

        if (bookError) throw bookError
        bookId = book.id
      }

      const existingEditions = editingBookId
        ? (books.find(book => book.id === editingBookId)?.book_editions || [])
        : []

      const desiredEditions = []

      if (form.physical) {
        desiredEditions.push({
          book_id: bookId,
          format: 'physical',
          price: Number(form.physical_price),
          stock_quantity: Number(form.physical_stock || 0)
        })
      }

      if (form.ebook) {
        desiredEditions.push({
          book_id: bookId,
          format: 'ebook',
          price: Number(form.ebook_price),
          stock_quantity: 0
        })
      }

      for (const format of ['physical', 'ebook']) {
        const desired = desiredEditions.find(
          edition => edition.format === format
        )

        const existing = existingEditions.find(
          edition => edition.format === format
        )

        if (desired && existing) {
          const { error: editionError } = await supabase
            .from('book_editions')
            .update({
              price: desired.price,
              stock_quantity: desired.stock_quantity
            })
            .eq('id', existing.id)

          if (editionError) throw editionError
        } else if (desired && !existing) {
          const { error: editionError } = await supabase
            .from('book_editions')
            .insert(desired)

          if (editionError) throw editionError
        } else if (!desired && existing) {
          const { count, error: orderCheckError } = await supabase
            .from('order_items')
            .select('id', { count: 'exact', head: true })
            .eq('edition_id', existing.id)

          if (orderCheckError) throw orderCheckError

          if (count > 0) {
            throw new Error(
              `The ${format} format has existing orders and cannot be removed. Keep it selected and set its stock to zero if it is no longer available.`
            )
          }

          const { error: editionError } = await supabase
            .from('book_editions')
            .delete()
            .eq('id', existing.id)

          if (editionError) throw editionError
        }
      }

      setForm(emptyBook)
      setCover(null)
      setEditingBookId(null)
      event.target.reset()

      setMessage(
        editingBookId
          ? 'Book details updated successfully.'
          : 'Book successfully added to the library.'
      )

      await loadDashboard()
      setSection('books')
    } catch (err) {
      setError(err.message || 'Something went wrong while saving the book.')
    } finally {
      setSaving(false)
    }
  }

  async function editBook(bookId) {
    setError('')
    setMessage('')

    const { data: book, error: bookError } = await supabase
      .from('books')
      .select(`
        id, title, isbn, description, publisher, publication_year,
        language, cover_image_url, author_id, category_id, is_active
      `)
      .eq('id', bookId)
      .single()

    if (bookError) {
      setError(bookError.message)
      return
    }

    const { data: editions, error: editionsError } = await supabase
      .from('book_editions')
      .select('id, format, price, stock_quantity')
      .eq('book_id', bookId)

    if (editionsError) {
      setError(editionsError.message)
      return
    }

    const physical = editions?.find(item => item.format === 'physical')
    const ebook = editions?.find(item => item.format === 'ebook')

    setForm({
      ...emptyBook,
      title: book.title || '',
      isbn: book.isbn || '',
      description: book.description || '',
      publisher: book.publisher || '',
      publication_year: book.publication_year?.toString() || '',
      language: book.language || 'English',
      category_id: book.category_id || '',
      author_id: book.author_id || '',
      cover_image_url: book.cover_image_url || null,
      physical: Boolean(physical),
      physical_price: physical?.price?.toString() || '',
      physical_stock: physical?.stock_quantity?.toString() || '0',
      ebook: Boolean(ebook),
      ebook_price: ebook?.price?.toString() || ''
    })

    setEditingBookId(bookId)
    setCover(null)
    setSection('add')
  }

  async function archiveBook(bookId) {
    const confirmed = window.confirm(
      'Archive this book? It will no longer appear in the customer catalogue.'
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('books')
      .update({ is_active: false })
      .eq('id', bookId)

    if (error) {
      setError(error.message)
    } else {
      setMessage('Book archived successfully.')
      await loadDashboard()
    }
  }

  // ADVERTISEMENT MANAGEMENT

  async function saveAdvertisement(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    try {
      const destination = adForm.destination_url.trim()

      let parsedUrl
      try {
        parsedUrl = new URL(destination)
      } catch {
        throw new Error('Enter a valid destination website URL.')
      }

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('The destination link must begin with http:// or https://.')
      }

      if (
        adForm.starts_at &&
        adForm.ends_at &&
        new Date(adForm.ends_at) <= new Date(adForm.starts_at)
      ) {
        throw new Error('The end date must be later than the start date.')
      }

      let imageUrl = adForm.image_url || null

      if (adImage) {
        if (!adImage.type.startsWith('image/')) {
          throw new Error('Please select a valid image file.')
        }

        if (adImage.size > 5 * 1024 * 1024) {
          throw new Error('The advertisement image must be smaller than 5 MB.')
        }

        const safeName = adImage.name.replace(/[^a-zA-Z0-9.-]/g, '-')
        const filePath = `${Date.now()}-${safeName}`

        const { error: uploadError } = await supabase.storage
          .from('advertisement-images')
          .upload(filePath, adImage)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('advertisement-images')
          .getPublicUrl(filePath)

        imageUrl = urlData.publicUrl
      }

      const payload = {
        title: adForm.title.trim(),
        advertiser_name: adForm.advertiser_name.trim(),
        description: adForm.description.trim() || null,
        image_url: imageUrl,
        destination_url: destination,
        placement: adForm.placement,
        is_active: adForm.is_active,
        starts_at: adForm.starts_at
          ? new Date(adForm.starts_at).toISOString()
          : null,
        ends_at: adForm.ends_at
          ? new Date(adForm.ends_at).toISOString()
          : null
      }

      if (editingAdId) {
        const { error: updateError } = await supabase
          .from('advertisements')
          .update(payload)
          .eq('id', editingAdId)

        if (updateError) throw updateError

        setMessage('Advertisement updated successfully.')
      } else {
        const { error: insertError } = await supabase
          .from('advertisements')
          .insert({
            ...payload,
            created_by: session.user.id
          })

        if (insertError) throw insertError

        setMessage('Advertisement created successfully.')
      }

      resetAdForm()
      await loadDashboard()
      setSection('advertisements')
    } catch (err) {
      setError(err.message || 'Could not save this advertisement.')
    } finally {
      setSaving(false)
    }
  }

  function editAdvertisement(ad) {
    setError('')
    setMessage('')

    setAdForm({
      title: ad.title || '',
      advertiser_name: ad.advertiser_name || '',
      description: ad.description || '',
      destination_url: ad.destination_url || '',
      placement: ad.placement || 'homepage_spotlight',
      starts_at: toDateTimeLocal(ad.starts_at),
      ends_at: toDateTimeLocal(ad.ends_at),
      is_active: Boolean(ad.is_active),
      image_url: ad.image_url || null
    })

    setEditingAdId(ad.id)
    setAdImage(null)
    setSection('advertisement-form')
  }

  async function toggleAdvertisement(ad) {
    setError('')
    setMessage('')

    const { error } = await supabase
      .from('advertisements')
      .update({ is_active: !ad.is_active })
      .eq('id', ad.id)

    if (error) {
      setError(error.message)
    } else {
      setMessage(
        ad.is_active
          ? 'Advertisement deactivated.'
          : 'Advertisement activated.'
      )
      await loadDashboard()
    }
  }

  async function deleteAdvertisement(adId) {
    const confirmed = window.confirm(
      'Delete this advertisement permanently?'
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('advertisements')
      .delete()
      .eq('id', adId)

    if (error) {
      setError(error.message)
    } else {
      setMessage('Advertisement deleted successfully.')
      await loadDashboard()
    }
  }

  function getAdStatus(ad) {
    const now = new Date()

    if (!ad.is_active) return 'Inactive'
    if (ad.starts_at && new Date(ad.starts_at) > now) return 'Scheduled'
    if (ad.ends_at && new Date(ad.ends_at) < now) return 'Expired'

    return 'Active'
  }

  if (checking) {
    return (
      <div className="admin-loading">
        Checking administrator access...
      </div>
    )
  }

  if (!session || !admin) {
    return (
      <div className="admin-login-page">
        <form className="admin-login-card" onSubmit={login}>
          <div className="admin-emblem">L</div>
          <span className="admin-kicker">LEE'S BIBLIOTECA</span>
          <h1>Administrator Login</h1>
          <p>Sign in to manage your literary collection.</p>

          <label>Email address</label>
          <input
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="Administrator email"
            required
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Your password"
            required
          />

          {loginError && (
            <div className="admin-error">{loginError}</div>
          )}

          {error && <div className="admin-error">{error}</div>}

          <button className="admin-submit" type="submit">
            Sign in to Dashboard
          </button>

          <a className="back-to-store" href="/">
            ← Return to bookstore
          </a>
        </form>
      </div>
    )
  }

  const activeBooks = books.filter(book => book.is_active)
  const activeAds = advertisements.filter(ad => getAdStatus(ad) === 'Active')

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <a href="/" className="admin-brand">
          <span className="admin-emblem">L</span>
          <span>
            LEE'S<br />
            <strong>BIBLIOTECA</strong>
          </span>
        </a>

        <div className="admin-sidebar-label">WORKSPACE</div>

        <button
          className={section === 'overview' ? 'selected' : ''}
          onClick={() => setSection('overview')}
        >
          ◫ <span>Overview</span>
        </button>

        <button
          className={section === 'books' ? 'selected' : ''}
          onClick={() => setSection('books')}
        >
          ▤ <span>Manage Books</span>
        </button>

        <button
          className={section === 'add' ? 'selected' : ''}
          onClick={() => {
            setForm(emptyBook)
            setEditingBookId(null)
            setCover(null)
            setSection('add')
          }}
        >
          ＋ <span>Add New Book</span>
        </button>

        <button
          className={section === 'catalogue-data' ? 'selected' : ''}
          onClick={() => setSection('catalogue-data')}
        >
          ◈ <span>Authors & Categories</span>
        </button>

        <button
          className={
            section === 'advertisements' ||
            section === 'advertisement-form'
              ? 'selected'
              : ''
          }
          onClick={() => {
            resetAdForm()
            setSection('advertisements')
          }}
        >
          ◉ <span>Advertisements</span>
        </button>

        <div className="admin-sidebar-bottom">
          <a href="/" className="store-link">
            ↗ View customer website
          </a>
          <button onClick={logout}>
            ⇥ <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-kicker">ADMINISTRATION</span>
            <h1>
              {section === 'overview' && 'Dashboard Overview'}
              {section === 'books' && 'Manage Your Books'}
              {section === 'add' &&
                (editingBookId ? 'Edit Book' : 'Add a New Book')}
              {section === 'catalogue-data' && 'Authors & Categories'}
              {section === 'advertisements' && 'Advertisement Manager'}
              {section === 'advertisement-form' &&
                (editingAdId ? 'Edit Advertisement' : 'Create Advertisement')}
            </h1>
          </div>

          <div className="admin-user">
            <span className="admin-avatar">A</span>
            <span>Administrator</span>
          </div>
        </header>

        {message && (
          <div className="admin-success">{message}</div>
        )}

        {error && (
          <div className="admin-error admin-notice">{error}</div>
        )}

        {section === 'overview' && (
          <>
            <div className="admin-welcome">
              <span>YOUR LIBRARY, YOUR CONTROL</span>
              <h2>Welcome to your workspace.</h2>
              <p>
                Manage your collection and keep your catalogue up to date.
              </p>
              <button
                onClick={() => {
                  setForm(emptyBook)
                  setEditingBookId(null)
                  setSection('add')
                }}
              >
                + Add a book
              </button>
            </div>

            <div className="admin-stats">
              <div className="admin-stat-card">
                <span>TOTAL BOOKS</span>
                <strong>{books.length}</strong>
                <small>All catalogue records</small>
              </div>

              <div className="admin-stat-card">
                <span>ACTIVE BOOKS</span>
                <strong>{activeBooks.length}</strong>
                <small>Visible to customers</small>
              </div>

              <div className="admin-stat-card">
                <span>AUTHORS</span>
                <strong>{authors.length}</strong>
                <small>In your database</small>
              </div>

              <div className="admin-stat-card">
                <span>CATEGORIES</span>
                <strong>{categories.length}</strong>
                <small>Available collections</small>
              </div>

              <div className="admin-stat-card">
                <span>ADVERTISEMENTS</span>
                <strong>{advertisements.length}</strong>
                <small>{activeAds.length} currently active</small>
              </div>
            </div>

            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <span className="admin-kicker">RECENT ADDITIONS</span>
                  <h2>Recently added books</h2>
                </div>
                <button onClick={() => setSection('books')}>
                  View all →
                </button>
              </div>

              {books.length === 0 ? (
                <p className="admin-empty">
                  No books have been added yet.
                </p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>BOOK TITLE</th>
                        <th>AUTHOR</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {books.slice(0, 5).map(book => (
                        <tr key={book.id}>
                          <td>{book.title}</td>
                          <td>{book.authors?.full_name || 'Not assigned'}</td>
                          <td>
                            <span
                              className={
                                book.is_active
                                  ? 'status-active'
                                  : 'status-archived'
                              }
                            >
                              {book.is_active ? 'Active' : 'Archived'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {section === 'books' && (
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <span className="admin-kicker">YOUR COLLECTION</span>
                <h2>All catalogue records</h2>
              </div>
              <button
                onClick={() => {
                  setForm(emptyBook)
                  setEditingBookId(null)
                  setCover(null)
                  setSection('add')
                }}
              >
                + Add book
              </button>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>BOOK</th>
                    <th>AUTHOR</th>
                    <th>CATEGORY</th>
                    <th>FORMATS</th>
                    <th>STATUS</th>
                    <th>ACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {books.map(book => (
                    <tr key={book.id}>
                      <td>{book.title}</td>
                      <td>{book.authors?.full_name || '—'}</td>
                      <td>{book.categories?.name || '—'}</td>
                      <td>
                        {(book.book_editions || [])
                          .map(item => item.format)
                          .join(', ') || '—'}
                      </td>
                      <td>
                        <span
                          className={
                            book.is_active
                              ? 'status-active'
                              : 'status-archived'
                          }
                        >
                          {book.is_active ? 'Active' : 'Archived'}
                        </span>
                      </td>
                      <td>
                        <div className="book-action-buttons">
                          <button
                            type="button"
                            className="edit-book-button"
                            onClick={() => editBook(book.id)}
                          >
                            Edit
                          </button>

                          {book.is_active && (
                            <button
                              type="button"
                              className="archive-button"
                              onClick={() => archiveBook(book.id)}
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {books.length === 0 && (
              <p className="admin-empty">Your catalogue is empty.</p>
            )}
          </section>
        )}

        {section === 'catalogue-data' && (
          <div className="admin-management-grid">
            <section className="admin-panel">
              <span className="admin-kicker">AUTHOR DIRECTORY</span>
              <h2 className="management-title">Add an author</h2>

              <form onSubmit={addAuthor}>
                <div className="admin-field">
                  <label>Author's full name *</label>
                  <input
                    value={authorForm.full_name}
                    onChange={event =>
                      setAuthorForm({
                        ...authorForm,
                        full_name: event.target.value
                      })
                    }
                    placeholder="e.g. Chinua Achebe"
                    required
                  />
                </div>

                <div className="admin-field">
                  <label>Biography</label>
                  <textarea
                    rows="5"
                    value={authorForm.biography}
                    onChange={event =>
                      setAuthorForm({
                        ...authorForm,
                        biography: event.target.value
                      })
                    }
                    placeholder="Write a short author biography..."
                  />
                </div>

                <button className="admin-submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Add Author'}
                </button>
              </form>

              <div className="management-list">
                <h3>Registered authors ({authors.length})</h3>

                {authors.length === 0 ? (
                  <p className="admin-empty">No authors added yet.</p>
                ) : (
                  authors.map(author => (
                    <div className="management-item" key={author.id}>
                      <strong>{author.full_name}</strong>
                      <span>
                        {author.biography || 'No biography provided'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="admin-panel">
              <span className="admin-kicker">COLLECTION ORGANISATION</span>
              <h2 className="management-title">Add a category</h2>

              <form onSubmit={addCategory}>
                <div className="admin-field">
                  <label>Category name *</label>
                  <input
                    value={categoryForm.name}
                    onChange={event =>
                      setCategoryForm({
                        ...categoryForm,
                        name: event.target.value
                      })
                    }
                    placeholder="e.g. African Literature"
                    required
                  />
                </div>

                <div className="admin-field">
                  <label>Description</label>
                  <textarea
                    rows="5"
                    value={categoryForm.description}
                    onChange={event =>
                      setCategoryForm({
                        ...categoryForm,
                        description: event.target.value
                      })
                    }
                    placeholder="Describe this collection..."
                  />
                </div>

                <button className="admin-submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Add Category'}
                </button>
              </form>

              <div className="management-list">
                <h3>Available categories ({categories.length})</h3>

                {categories.length === 0 ? (
                  <p className="admin-empty">No categories added yet.</p>
                ) : (
                  categories.map(category => (
                    <div className="management-item" key={category.id}>
                      <strong>{category.name}</strong>
                      <span>
                        {category.description || 'No description provided'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {section === 'add' && (
          <form className="admin-panel book-form" onSubmit={addBook}>
            <div className="admin-panel-heading">
              <div>
                <span className="admin-kicker">CATALOGUE MANAGEMENT</span>
                <h2>
                  {editingBookId
                    ? 'Update book information'
                    : 'Book information'}
                </h2>
              </div>
            </div>

            <div className="admin-form-grid">
              <div className="admin-field full">
                <label>Book title *</label>
                <input
                  name="title"
                  value={form.title}
                  onChange={updateForm}
                  required
                />
              </div>

              <div className="admin-field">
                <label>Author</label>
                <select
                  name="author_id"
                  value={form.author_id}
                  onChange={updateForm}
                >
                  <option value="">Select author</option>
                  {authors.map(author => (
                    <option key={author.id} value={author.id}>
                      {author.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field">
                <label>Category</label>
                <select
                  name="category_id"
                  value={form.category_id}
                  onChange={updateForm}
                >
                  <option value="">Select category</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field">
                <label>ISBN</label>
                <input
                  name="isbn"
                  value={form.isbn}
                  onChange={updateForm}
                />
              </div>

              <div className="admin-field">
                <label>Publisher</label>
                <input
                  name="publisher"
                  value={form.publisher}
                  onChange={updateForm}
                />
              </div>

              <div className="admin-field">
                <label>Publication year</label>
                <input
                  type="number"
                  name="publication_year"
                  value={form.publication_year}
                  onChange={updateForm}
                  min="1000"
                  max="2100"
                />
              </div>

              <div className="admin-field">
                <label>Language</label>
                <input
                  name="language"
                  value={form.language}
                  onChange={updateForm}
                />
              </div>

              <div className="admin-field full">
                <label>Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={updateForm}
                  rows="5"
                />
              </div>

              <div className="admin-field full">
                <label>Book cover image (maximum 5 MB)</label>
                {form.cover_image_url && (
                  <img
                    className="admin-current-image"
                    src={form.cover_image_url}
                    alt="Current book cover"
                  />
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={event =>
                    setCover(event.target.files?.[0] || null)
                  }
                />
              </div>
            </div>

            <div className="admin-edition-heading">
              <h3>Available formats and pricing</h3>
              <p>
                Choose the formats in which customers can purchase this book.
              </p>
            </div>

            <div className="admin-format-card">
              <label className="format-check">
                <input
                  type="checkbox"
                  name="physical"
                  checked={form.physical}
                  onChange={updateForm}
                />
                <strong>Physical book</strong>
              </label>

              {form.physical && (
                <div className="admin-form-grid">
                  <div className="admin-field">
                    <label>Price (KES) *</label>
                    <input
                      type="number"
                      name="physical_price"
                      value={form.physical_price}
                      onChange={updateForm}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>

                  <div className="admin-field">
                    <label>Available stock</label>
                    <input
                      type="number"
                      name="physical_stock"
                      value={form.physical_stock}
                      onChange={updateForm}
                      min="0"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="admin-format-card">
              <label className="format-check">
                <input
                  type="checkbox"
                  name="ebook"
                  checked={form.ebook}
                  onChange={updateForm}
                />
                <strong>Digital ebook</strong>
              </label>

              {form.ebook && (
                <div className="admin-field">
                  <label>Price (KES) *</label>
                  <input
                    type="number"
                    name="ebook_price"
                    value={form.ebook_price}
                    onChange={updateForm}
                    min="0"
                    step="0.01"
                    required
                  />
                  <small>
                    The authorised ebook file will be uploaded and secured
                    separately.
                  </small>
                </div>
              )}
            </div>

            <div className="admin-form-actions">
              <button
                type="button"
                className="admin-cancel"
                onClick={() => {
                  setForm(emptyBook)
                  setCover(null)
                  setEditingBookId(null)
                  setSection('books')
                }}
              >
                Cancel
              </button>

              <button
                className="admin-submit"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'Saving book...'
                  : editingBookId
                    ? 'Save book changes'
                    : 'Save book to catalogue'}
              </button>
            </div>
          </form>
        )}

        {section === 'advertisements' && (
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <span className="admin-kicker">BUSINESS PARTNERSHIPS</span>
                <h2>Manage advertisements</h2>
                <p className="admin-description">
                  Create and manage promotional spaces displayed on the
                  customer website.
                </p>
              </div>

              <button
                onClick={() => {
                  resetAdForm()
                  setSection('advertisement-form')
                }}
              >
                + Create advert
              </button>
            </div>

            <div className="ad-placement-summary">
              {placements.map(placement => (
                <div className="ad-placement-card" key={placement.value}>
                  <span>{placement.label}</span>
                  <strong>
                    {advertisements.filter(
                      ad => ad.placement === placement.value
                    ).length}
                  </strong>
                  <small>Advertisements</small>
                </div>
              ))}
            </div>

            {advertisements.length === 0 ? (
              <p className="admin-empty">
                You have not created any advertisements yet.
              </p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ADVERTISEMENT</th>
                      <th>ADVERTISER</th>
                      <th>PLACEMENT</th>
                      <th>STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>

                  <tbody>
                    {advertisements.map(ad => (
                      <tr key={ad.id}>
                        <td>
                          <div className="ad-table-title">
                            {ad.image_url && (
                              <img
                                src={ad.image_url}
                                alt=""
                              />
                            )}
                            <strong>{ad.title}</strong>
                          </div>
                        </td>
                        <td>{ad.advertiser_name}</td>
                        <td>
                          {placements.find(
                            item => item.value === ad.placement
                          )?.label || ad.placement}
                        </td>
                        <td>
                          <span
                            className={
                              getAdStatus(ad) === 'Active'
                                ? 'status-active'
                                : 'status-archived'
                            }
                          >
                            {getAdStatus(ad)}
                          </span>
                        </td>
                        <td>
                          <div className="book-action-buttons">
                            <button
                              className="edit-book-button"
                              type="button"
                              onClick={() => editAdvertisement(ad)}
                            >
                              Edit
                            </button>

                            <button
                              className="ad-toggle-button"
                              type="button"
                              onClick={() => toggleAdvertisement(ad)}
                            >
                              {ad.is_active ? 'Deactivate' : 'Activate'}
                            </button>

                            <button
                              className="archive-button"
                              type="button"
                              onClick={() => deleteAdvertisement(ad.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {section === 'advertisement-form' && (
          <form
            className="admin-panel"
            onSubmit={saveAdvertisement}
          >
            <div className="admin-panel-heading">
              <div>
                <span className="admin-kicker">ADVERTISING SPACE</span>
                <h2>
                  {editingAdId
                    ? 'Update advertisement'
                    : 'Create a new advertisement'}
                </h2>
              </div>
            </div>

            <div className="admin-form-grid">
              <div className="admin-field">
                <label>Advertisement title *</label>
                <input
                  name="title"
                  value={adForm.title}
                  onChange={updateAdForm}
                  placeholder="e.g. Premium Web Hosting"
                  required
                />
              </div>

              <div className="admin-field">
                <label>Advertiser / business name *</label>
                <input
                  name="advertiser_name"
                  value={adForm.advertiser_name}
                  onChange={updateAdForm}
                  placeholder="Business name"
                  required
                />
              </div>

              <div className="admin-field full">
                <label>Short description</label>
                <textarea
                  name="description"
                  value={adForm.description}
                  onChange={updateAdForm}
                  rows="4"
                  placeholder="Write a short description of the advert..."
                />
              </div>

              <div className="admin-field full">
                <label>Destination website URL *</label>
                <input
                  type="url"
                  name="destination_url"
                  value={adForm.destination_url}
                  onChange={updateAdForm}
                  placeholder="https://example.com"
                  required
                />
                <small>
                  Customers will be directed to this website when they click
                  the advertisement.
                </small>
              </div>

              <div className="admin-field full">
                <label>Advertisement placement *</label>
                <select
                  name="placement"
                  value={adForm.placement}
                  onChange={updateAdForm}
                  required
                >
                  {placements.map(placement => (
                    <option
                      key={placement.value}
                      value={placement.value}
                    >
                      {placement.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field">
                <label>Start date and time</label>
                <input
                  type="datetime-local"
                  name="starts_at"
                  value={adForm.starts_at}
                  onChange={updateAdForm}
                />
                <small>Leave blank to allow immediate scheduling.</small>
              </div>

              <div className="admin-field">
                <label>End date and time</label>
                <input
                  type="datetime-local"
                  name="ends_at"
                  value={adForm.ends_at}
                  onChange={updateAdForm}
                />
                <small>Leave blank if the advertisement has no end date.</small>
              </div>

              <div className="admin-field full">
                <label>Advertisement image (maximum 5 MB)</label>
                {adForm.image_url && (
                  <img
                    className="admin-ad-preview"
                    src={adForm.image_url}
                    alt="Current advertisement"
                  />
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={event =>
                    setAdImage(event.target.files?.[0] || null)
                  }
                />
              </div>

              <div className="admin-field full">
                <label className="format-check">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={adForm.is_active}
                    onChange={updateAdForm}
                  />
                  <strong>Advertisement is active</strong>
                </label>
              </div>
            </div>

            <div className="admin-form-actions">
              <button
                type="button"
                className="admin-cancel"
                onClick={() => {
                  resetAdForm()
                  setSection('advertisements')
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="admin-submit"
                disabled={saving}
              >
                {saving
                  ? 'Saving advertisement...'
                  : editingAdId
                    ? 'Save advertisement changes'
                    : 'Create advertisement'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}

export default Admin
