
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import Admin from './Admin'
import './App.css'

const WHATSAPP_NUMBER = '254712215746'
const DISPLAY_PHONE = '0712215746'
const CART_STORAGE_KEY = 'leesBibliotecaCart'

const money = value =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0
  }).format(Number(value || 0))

function App() {
  if (window.location.pathname === '/admin') {
    return <Admin />
  }

  return <Storefront />
}

function Storefront() {
  const [books, setBooks] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cartOpen, setCartOpen] = useState(false)

  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || []
    } catch {
      return []
    }
  })

  useEffect(() => {
    loadStorefront()
  }, [])

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
  }, [cart])

  async function loadStorefront() {
    setLoading(true)
    setError('')

    const [booksResult, categoriesResult] = await Promise.all([
      supabase
        .from('books')
        .select(`
          id,
          title,
          isbn,
          description,
          publisher,
          publication_year,
          language,
          cover_image_url,
          author_id,
          category_id,
          authors(full_name),
          categories(name),
          book_editions(id, format, price, stock_quantity)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),

      supabase
        .from('categories')
        .select('id, name')
        .order('name')
    ])

    if (booksResult.error) {
      setError(booksResult.error.message)
    } else {
      setBooks(booksResult.data || [])
    }

    if (categoriesResult.error) {
      setError(categoriesResult.error.message)
    } else {
      setCategories(categoriesResult.data || [])
    }

    setLoading(false)
  }

  const filteredBooks = useMemo(() => {
    const term = search.toLowerCase().trim()

    return books.filter(book => {
      const matchesCategory =
        selectedCategory === 'all' ||
        book.category_id === selectedCategory

      const authorName = book.authors?.full_name || ''

      const matchesSearch =
        !term ||
        book.title?.toLowerCase().includes(term) ||
        authorName.toLowerCase().includes(term) ||
        book.isbn?.toLowerCase().includes(term) ||
        book.publisher?.toLowerCase().includes(term)

      return matchesCategory && matchesSearch
    })
  }, [books, search, selectedCategory])

  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  )

  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  )

  function addToCart(book, edition) {
    if (
      edition.format === 'physical' &&
      Number(edition.stock_quantity || 0) <= 0
    ) {
      alert('Sorry, this physical book is currently out of stock.')
      return
    }

    const itemKey = edition.id

    setCart(previous => {
      const existing = previous.find(item => item.id === itemKey)

      if (
        existing &&
        edition.format === 'physical' &&
        existing.quantity >= Number(edition.stock_quantity || 0)
      ) {
        alert('You have reached the available stock for this book.')
        return previous
      }

      if (existing) {
        return previous.map(item =>
          item.id === itemKey
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }

      return [
        ...previous,
        {
          id: edition.id,
          book_id: book.id,
          title: book.title,
          author: book.authors?.full_name || 'Unknown author',
          format: edition.format,
          price: Number(edition.price),
          quantity: 1,
          stock: edition.format === 'physical'
            ? Number(edition.stock_quantity || 0)
            : null,
          cover: book.cover_image_url || null
        }
      ]
    })

    setCartOpen(true)
  }

  function changeQuantity(itemId, amount) {
    setCart(previous =>
      previous
        .map(item => {
          if (item.id !== itemId) return item

          const nextQuantity = item.quantity + amount

          if (nextQuantity < 1) return null

          if (
            item.format === 'physical' &&
            nextQuantity > item.stock
          ) {
            alert('You cannot order more than the available stock.')
            return item
          }

          return { ...item, quantity: nextQuantity }
        })
        .filter(Boolean)
    )
  }

  function removeFromCart(itemId) {
    setCart(previous => previous.filter(item => item.id !== itemId))
  }

  function contactWhatsApp(message) {
    const url =
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`

    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function sendOrder() {
    if (cart.length === 0) return

    const orderLines = cart.map((item, index) =>
      `${index + 1}. ${item.title}\n` +
      `   Format: ${item.format}\n` +
      `   Quantity: ${item.quantity}\n` +
      `   Unit price: ${money(item.price)}\n` +
      `   Subtotal: ${money(item.price * item.quantity)}`
    )

    const message =
      `Hello Lee's Biblioteca!\n\n` +
      `I would like to enquire about placing the following order:\n\n` +
      `${orderLines.join('\n\n')}\n\n` +
      `Estimated total: ${money(cartTotal)}\n\n` +
      `Please assist me with payment and delivery/collection arrangements.\n\n` +
      `Thank you.`

    contactWhatsApp(message)
  }

  function advertiseWithUs(placement) {
    const message =
      `Hello Lee's Biblioteca!\n\n` +
      `I am interested in advertising my website/business on your platform.\n\n` +
      `Advertising placement: ${placement}\n\n` +
      `Please share your advertising opportunities, rates and requirements.`

    contactWhatsApp(message)
  }

  return (
    <div className="biblioteca">

      {/* NAVIGATION */}
      <nav className="navbar">
        <a href="#home" className="brand">
          <span className="brand-mark">L</span>
          <span className="brand-name">
            LEE'S
            <strong>BIBLIOTECA</strong>
          </span>
        </a>

        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#catalogue">Books</a>
          <a href="#advertise">Advertise</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </div>

        <button
          className="cart-nav-button"
          onClick={() => setCartOpen(true)}
          aria-label="Open shopping cart"
        >
          <span>Bag</span>
          <span className="cart-count">{cartCount}</span>
        </button>
      </nav>

      {/* HERO */}
      <section className="hero" id="home">
        <div className="hero-content">
          <span className="eyebrow">
            THE HOME OF GREAT STORIES AND IDEAS
          </span>

          <h1>
            A World of Knowledge,
            <em> Within Reach.</em>
          </h1>

          <p>
            Explore literature, philosophy, technology, history and
            countless other worlds through books that inspire the mind.
          </p>

          <div className="hero-actions">
            <a href="#catalogue" className="primary-button">
              Explore the collection
            </a>

            <a href="#about" className="secondary-button">
              Discover our story
            </a>
          </div>
        </div>

        <div className="hero-decoration">
          <span className="hero-letter">L</span>
          <span className="hero-decoration-caption">
            KNOWLEDGE · CULTURE · DISCOVERY
          </span>
        </div>
      </section>

      {/* INTRODUCTION */}
      <section className="collection-intro">
        <div>
          <span className="eyebrow">THE LIBRARY</span>
          <h2>Find your next great read.</h2>
        </div>

        <p>
          From timeless classics to contemporary discoveries, find
          something worth reading, learning and remembering.
        </p>
      </section>

      {/* CATALOGUE */}
      <section className="catalogue-section" id="catalogue">
        <div className="section-heading">
          <div>
            <span className="eyebrow">OUR COLLECTION</span>
            <h2>Explore the catalogue</h2>
          </div>

          <span className="book-count">
            {filteredBooks.length} books
          </span>
        </div>

        <div className="catalogue-toolbar">
          <div className="search-box">
            <span className="search-icon">⌕</span>

            <input
              type="search"
              placeholder="Search by title, author, ISBN or publisher..."
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>

          <button
            className="clear-search"
            onClick={() => {
              setSearch('')
              setSelectedCategory('all')
            }}
          >
            Clear filters
          </button>
        </div>

        <div className="category-filters">
          <button
            className={selectedCategory === 'all' ? 'active' : ''}
            onClick={() => setSelectedCategory('all')}
          >
            All books
          </button>

          {categories.map(category => (
            <button
              key={category.id}
              className={
                selectedCategory === category.id ? 'active' : ''
              }
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>

        {loading && (
          <div className="store-message">
            Opening the library...
          </div>
        )}

        {error && (
          <div className="store-error">
            {error}
          </div>
        )}

        {!loading && !error && filteredBooks.length === 0 && (
          <div className="store-message">
            <h3>No books found.</h3>
            <p>
              Try another search or select a different category.
            </p>
          </div>
        )}

        <div className="book-grid">
          {filteredBooks.map(book => (
            <article className="book-card" key={book.id}>
              <div className="book-cover">
                {book.cover_image_url ? (
                  <img
                    src={book.cover_image_url}
                    alt={book.title}
                    loading="lazy"
                    onError={event => {
                      event.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="cover-placeholder">
                    <span>LEE'S BIBLIOTECA</span>
                    <strong>{book.title}</strong>
                    <small>
                      {book.authors?.full_name || 'Literary collection'}
                    </small>
                  </div>
                )}

                <span className="book-category">
                  {book.categories?.name || 'BOOK'}
                </span>
              </div>

              <div className="book-details">
                <span className="book-author">
                  {book.authors?.full_name || 'Unknown author'}
                </span>

                <h3>{book.title}</h3>

                <p className="book-description">
                  {book.description ||
                    'Discover this title from our growing collection.'}
                </p>

                {book.publication_year && (
                  <span className="book-year">
                    Published {book.publication_year}
                  </span>
                )}

                <div className="book-formats">
                  {(book.book_editions || []).map(edition => {
                    const outOfStock =
                      edition.format === 'physical' &&
                      Number(edition.stock_quantity || 0) <= 0

                    return (
                      <div className="edition-option" key={edition.id}>
                        <div className="edition-info">
                          <span>
                            {edition.format === 'physical'
                              ? 'Physical book'
                              : 'Digital ebook'}
                          </span>

                          <strong>{money(edition.price)}</strong>

                          {edition.format === 'physical' && (
                            <small>
                              {outOfStock
                                ? 'Out of stock'
                                : `${edition.stock_quantity} available`}
                            </small>
                          )}
                        </div>

                        <button
                          className="add-cart-button"
                          disabled={outOfStock}
                          onClick={() => addToCart(book, edition)}
                        >
                          {outOfStock ? 'Unavailable' : 'Add +'}
                        </button>
                      </div>
                    )
                  })}

                  {(!book.book_editions ||
                    book.book_editions.length === 0) && (
                    <p className="unavailable-message">
                      Contact us for availability.
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ADVERTISING OPPORTUNITIES */}
      <section className="advertising-section" id="advertise">
        <div className="advertising-heading">
          <span className="eyebrow">PARTNERSHIPS & PROMOTION</span>
          <h2>Have something worth sharing?</h2>
          <p>
            Reach readers, learners and curious minds. Lee's Biblioteca
            provides advertising opportunities for websites, businesses,
            educational platforms and other organisations.
          </p>
        </div>

        <div className="advertising-grid">
          <article className="advertising-card">
            <span className="ad-number">01</span>
            <span className="ad-label">HOMEPAGE PLACEMENT</span>
            <h3>Homepage Spotlight</h3>
            <p>
              Feature your website or business in a prominent position
              on our homepage.
            </p>
            <button onClick={() => advertiseWithUs('Homepage Spotlight')}>
              Enquire about this space →
            </button>
          </article>

          <article className="advertising-card featured-ad">
            <span className="ad-number">02</span>
            <span className="ad-label">FEATURED PROMOTION</span>
            <h3>Featured Partner</h3>
            <p>
              Showcase your brand, service or platform to visitors
              exploring our catalogue.
            </p>
            <button onClick={() => advertiseWithUs('Featured Partner')}>
              Enquire about this space →
            </button>
          </article>

          <article className="advertising-card">
            <span className="ad-number">03</span>
            <span className="ad-label">SPONSORED CONTENT</span>
            <h3>Sponsored Features</h3>
            <p>
              Promote relevant educational resources, websites,
              publications and services.
            </p>
            <button onClick={() => advertiseWithUs('Sponsored Features')}>
              Enquire about this space →
            </button>
          </article>
        </div>

        <div className="advertising-footer">
          <p>
            Interested in becoming an advertising partner?
            Let's discuss a placement that works for your brand.
          </p>

          <button
            onClick={() => advertiseWithUs('General advertising enquiry')}
          >
            Advertise with us
          </button>
        </div>
      </section>

      {/* ABOUT */}
      <section className="about-section" id="about">
        <div className="about-symbol">L</div>

        <div className="about-content">
          <span className="eyebrow">OUR PHILOSOPHY</span>
          <h2>Knowledge should have no boundaries.</h2>

          <p>
            Lee's Biblioteca is built around the belief that books
            connect people to ideas, experiences and perspectives
            beyond their immediate world.
          </p>

          <p>
            We bring together physical books and digital reading
            experiences to make discovering knowledge more accessible.
          </p>
        </div>
      </section>

      {/* CONTACT */}
      <section className="contact-section" id="contact">
        <div>
          <span className="eyebrow">GET IN TOUCH</span>
          <h2>Let's talk books.</h2>
          <p>
            Have a question about a book, an order, a partnership
            or advertising? Get in touch with us.
          </p>
        </div>

        <div className="contact-details">
          <span>CALL OR WHATSAPP</span>

          <a href={`tel:${DISPLAY_PHONE}`}>
            {DISPLAY_PHONE}
          </a>

          <a
            className="contact-whatsapp"
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noreferrer"
          >
            Message us on WhatsApp →
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <a href="#home" className="footer-brand">
          LEE'S BIBLIOTECA
        </a>

        <p>A World of Knowledge, Within Reach.</p>

        <div className="footer-links">
          <a href="#catalogue">Books</a>
          <a href="#advertise">Advertise</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </div>

        <small>
          © {new Date().getFullYear()} Lee's Biblioteca. All rights reserved.
        </small>
      </footer>

      {/* SHOPPING CART DRAWER */}
      {cartOpen && (
        <div
          className="cart-overlay"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              setCartOpen(false)
            }
          }}
        >
          <aside className="cart-drawer">
            <div className="cart-header">
              <div>
                <span className="eyebrow">YOUR SELECTION</span>
                <h2>Shopping bag ({cartCount})</h2>
              </div>

              <button
                className="cart-close"
                onClick={() => setCartOpen(false)}
                aria-label="Close shopping cart"
              >
                ×
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="empty-cart">
                <span>◇</span>
                <h3>Your bag is empty.</h3>
                <p>
                  Explore our collection and add books you'd like to
                  purchase.
                </p>
                <button
                  onClick={() => {
                    setCartOpen(false)
                    document.getElementById('catalogue')?.scrollIntoView({
                      behavior: 'smooth'
                    })
                  }}
                >
                  Explore books
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map(item => (
                    <div className="cart-item" key={item.id}>
                      <div className="cart-item-cover">
                        {item.cover ? (
                          <img src={item.cover} alt={item.title} />
                        ) : (
                          <span>L</span>
                        )}
                      </div>

                      <div className="cart-item-info">
                        <h3>{item.title}</h3>
                        <span>{item.author}</span>
                        <small>
                          {item.format === 'physical'
                            ? 'Physical book'
                            : 'Digital ebook'}
                        </small>

                        <strong>{money(item.price)}</strong>

                        <div className="quantity-controls">
                          <button
                            onClick={() => changeQuantity(item.id, -1)}
                            aria-label={`Decrease quantity of ${item.title}`}
                          >
                            −
                          </button>

                          <span>{item.quantity}</span>

                          <button
                            onClick={() => changeQuantity(item.id, 1)}
                            aria-label={`Increase quantity of ${item.title}`}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <button
                        className="remove-item"
                        onClick={() => removeFromCart(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="cart-bottom">
                  <div className="cart-total">
                    <span>Estimated total</span>
                    <strong>{money(cartTotal)}</strong>
                  </div>

                  <p>
                    Delivery or collection charges, where applicable,
                    will be confirmed separately.
                  </p>

                  <button
                    className="whatsapp-order-button"
                    onClick={sendOrder}
                  >
                    Continue with WhatsApp →
                  </button>

                  <button
                    className="continue-shopping"
                    onClick={() => setCartOpen(false)}
                  >
                    Continue shopping
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {/* FLOATING WHATSAPP CONTACT */}
      <a
        className="floating-whatsapp"
        href={`https://wa.me/${WHATSAPP_NUMBER}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Contact Lee's Biblioteca on WhatsApp"
      >
        <span>WhatsApp</span>
      </a>

    </div>
  )
}

export default App
