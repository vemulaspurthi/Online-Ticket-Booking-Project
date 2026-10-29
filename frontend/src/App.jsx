
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import "./App.css";

const API_URL = "http://localhost:5000";

const EVENTS = [
  {
    id: 1,
    name: "Movie Night",
    category: "MOVIE",
    date: "15 November 2026",
    time: "6:00 PM",
    venue: "PVR Cinemas",
    price: 250,
    image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800",
    description: "Experience your favourite movies on the big screen.",
  },
  {
    id: 2,
    name: "Music Concert",
    category: "MUSIC",
    date: "20 November 2026",
    time: "7:00 PM",
    venue: "Open Air Arena",
    price: 500,
    image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800",
    description: "Enjoy an unforgettable night of live music.",
  },
  {
    id: 3,
    name: "Cricket Match",
    category: "SPORTS",
    date: "25 November 2026",
    time: "4:00 PM",
    venue: "City Cricket Stadium",
    price: 350,
    image: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800",
    description: "Feel the excitement of live cricket action.",
  },
];

const SEATS = Array.from({ length: 40 }, (_, index) => ({
  id: `S${index + 1}`,
  number: index + 1,
}));

export default function App() {
  const [page, setPage] = useState("login");
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser] = useState(null);

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [bookedSeats, setBookedSeats] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [ticket, setTicket] = useState(null);

  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [message, setMessage] = useState("");
  const [verifyId, setVerifyId] = useState("");
  const [verifiedBooking, setVerifiedBooking] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("tickethubUser");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setPage("home");
      } catch {
        localStorage.removeItem("tickethubUser");
      }
    }
  }, []);

  async function authenticate(event) {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    if (authMode === "register" && !customerName.trim()) {
      setMessage("Please enter your full name.");
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        authMode === "login" ? "/api/auth/login" : "/api/auth/register";

      const body =
        authMode === "login"
          ? { email: email.trim(), password }
          : {
              name: customerName.trim(),
              customerName: customerName.trim(),
              email: email.trim(),
              password,
            };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.message ||
            `${authMode === "login" ? "Login" : "Registration"} failed.`
        );
      }

      const loggedInUser = result.user || {
        name: result.name || customerName.trim() || email.split("@")[0],
        email: result.email || email.trim(),
      };

      if (result.token) {
        localStorage.setItem("tickethubToken", result.token);
      }

      localStorage.setItem("tickethubUser", JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      setCustomerName(loggedInUser.name || loggedInUser.customerName || "");
      setPassword("");
      setMessage("");
      setPage("home");
      await loadBookings();
    } catch (error) {
      setMessage(
        `${error.message} Check that your backend supports ${authMode === "login" ? "/api/auth/login" : "/api/auth/register"}.`
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadBookings() {
    try {
      const response = await fetch(`${API_URL}/api/bookings`);
      if (!response.ok) throw new Error("Unable to load bookings.");

      const data = await response.json();
      const list = Array.isArray(data) ? data : data.bookings || [];
      setBookings(list);
    } catch (error) {
      console.error("Could not load bookings:", error.message);
    }
  }

  async function loadBookedSeats(eventName) {
    setLoadingSeats(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/booked-seats/${encodeURIComponent(eventName)}`
      );

      if (!response.ok) throw new Error("Unable to load booked seats.");

      const data = await response.json();
      setBookedSeats(data.bookedSeats || []);
    } catch (error) {
      console.error("Could not load booked seats:", error.message);
      setBookedSeats([]);
      setMessage("Could not load seat availability. Please try again.");
    } finally {
      setLoadingSeats(false);
    }
  }

  async function openBooking(event) {
    setSelectedEvent(event);
    setSelectedSeats([]);
    setMessage("");
    setBookedSeats([]);
    setPage("booking");
    await loadBookedSeats(event.name);
  }

  function toggleSeat(seatId) {
    if (bookedSeats.includes(seatId) || loadingSeats || loading) return;

    setSelectedSeats((previous) =>
      previous.includes(seatId)
        ? previous.filter((seat) => seat !== seatId)
        : [...previous, seatId]
    );
  }

  async function confirmBooking(event) {
    event.preventDefault();

    if (!user) {
      setMessage("Please log in before booking.");
      setPage("login");
      return;
    }

    if (!customerName.trim() || !email.trim()) {
      setMessage("Please enter your name and email.");
      return;
    }

    if (selectedSeats.length === 0) {
      setMessage("Please select at least one seat.");
      return;
    }

    setLoading(true);
    setMessage("");

    const bookingData = {
      customerName: customerName.trim(),
      email: email.trim(),
      eventName: selectedEvent.name,
      seats: [...selectedSeats],
      totalAmount: selectedSeats.length * selectedEvent.price,
    };

    try {
      const availabilityResponse = await fetch(
        `${API_URL}/api/booked-seats/${encodeURIComponent(selectedEvent.name)}`
      );

      if (!availabilityResponse.ok) {
        throw new Error("Could not check seat availability.");
      }

      const availability = await availabilityResponse.json();
      const latestBooked = availability.bookedSeats || [];
      setBookedSeats(latestBooked);

      const unavailable = selectedSeats.filter((seat) =>
        latestBooked.includes(seat)
      );

      if (unavailable.length) {
        setSelectedSeats((previous) =>
          previous.filter((seat) => !unavailable.includes(seat))
        );
        throw new Error(
          `Seats ${unavailable.join(", ")} are already booked. Choose other seats.`
        );
      }

      const response = await fetch(`${API_URL}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (result.bookedSeats?.length) {
          setBookedSeats((previous) =>
            [...new Set([...previous, ...result.bookedSeats])]
          );
        }
        throw new Error(result.message || "Booking failed.");
      }

      const savedBooking = {
        ...bookingData,
        ...(result.booking || {}),
      };

      setTicket(savedBooking);
      setSelectedSeats([]);
      await loadBookings();
      await loadBookedSeats(selectedEvent.name);
      setPage("ticket");
    } catch (error) {
      setMessage(error.message || "Booking failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function showMyBookings() {
    await loadBookings();
    setMessage("");
    setPage("bookings");
  }

  async function verifyTicket(event) {
    event.preventDefault();
    setVerifiedBooking(null);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/api/bookings`);
      if (!response.ok) throw new Error("Could not retrieve bookings.");

      const data = await response.json();
      const list = Array.isArray(data) ? data : data.bookings || [];
      setBookings(list);

      const found = list.find(
        (booking) =>
          String(booking.bookingId || booking._id) === verifyId.trim()
      );

      if (found) setVerifiedBooking(found);
      else setMessage("Ticket not found. Please check the booking ID.");
    } catch (error) {
      setMessage(error.message || "Could not verify the ticket.");
    }
  }

  function logout() {
    localStorage.removeItem("tickethubUser");
    localStorage.removeItem("tickethubToken");
    setUser(null);
    setSelectedEvent(null);
    setSelectedSeats([]);
    setMessage("");
    setPage("login");
    setAuthMode("login");
  }

  function backHome() {
    setSelectedEvent(null);
    setSelectedSeats([]);
    setMessage("");
    setPage("home");
  }

  return (
    <div className="app">
      <header className="navbar">
        <button className="brand" onClick={user ? backHome : () => setPage("login")}>
          🎟️ Ticket<span>Hub</span>
        </button>

        {user && (
          <nav className="nav-links">
            <button onClick={backHome}>Home</button>
            <button onClick={showMyBookings}>My Bookings</button>
            <button
              onClick={() => {
                setMessage("");
                setVerifiedBooking(null);
                setPage("verify");
              }}
            >
              Verify Ticket
            </button>
            <button onClick={logout}>Logout</button>
          </nav>
        )}
      </header>

      <main>
        {(page === "login" || page === "register") && (
          <section className="content-section centered">
            <div className="auth-card">
              <div className="auth-logo">🎟️</div>
              <span className="eyebrow">WELCOME TO TICKETHUB</span>
              <h1>{authMode === "login" ? "Welcome Back!" : "Create Account"}</h1>
              <p className="muted">
                {authMode === "login"
                  ? "Log in to book your favourite events."
                  : "Register to start booking tickets."}
              </p>

              <form className="booking-form" onSubmit={authenticate}>
                {authMode === "register" && (
                  <>
                    <label htmlFor="authName">Full Name</label>
                    <input
                      id="authName"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Enter your full name"
                      required
                    />
                  </>
                )}

                <label htmlFor="authEmail">Email Address</label>
                <input
                  id="authEmail"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />

                <label htmlFor="authPassword">Password</label>
                <input
                  id="authPassword"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  minLength={6}
                  required
                />

                {message && <p className="error-message">{message}</p>}

                <button
                  className="primary-btn full-btn"
                  type="submit"
                  disabled={loading}
                >
                  {loading
                    ? "Please wait..."
                    : authMode === "login"
                      ? "Login →"
                      : "Create Account →"}
                </button>
              </form>

              <p className="auth-switch">
                {authMode === "login"
                  ? "Don't have an account?"
                  : "Already have an account?"}{" "}
                <button
                  className="text-btn"
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "register" : "login");
                    setMessage("");
                  }}
                >
                  {authMode === "login" ? "Register" : "Login"}
                </button>
              </p>
            </div>
          </section>
        )}

        {page === "home" && user && (
          <>
            <section className="hero">
              <div className="hero-content">
                <span className="eyebrow">YOUR NEXT EXPERIENCE STARTS HERE</span>
                <h1>
                  Book tickets.
                  <br />
                  <span>Make memories.</span>
                </h1>
                <p>
                  Welcome, {user.name || user.customerName || user.email}!
                  Discover exciting events, choose your seats, and book your
                  next experience with TicketHub.
                </p>
                <button
                  className="primary-btn"
                  onClick={() =>
                    document.getElementById("events")?.scrollIntoView({
                      behavior: "smooth",
                    })
                  }
                >
                  Explore Events →
                </button>
              </div>

              <div className="hero-art">
                <div className="ticket-illustration">
                  <span>YOUR TICKET</span>
                  <div className="ticket-emoji">🎫</div>
                  <h3>Something amazing awaits!</h3>
                  <p>BOOK • EXPERIENCE • REPEAT</p>
                </div>
              </div>
            </section>

            <section className="events-section" id="events">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">FIND YOUR NEXT EXPERIENCE</span>
                  <h2>Upcoming Events</h2>
                </div>
                <p>Choose an event and reserve your seats.</p>
              </div>

              <div className="event-grid">
                {EVENTS.map((event) => (
                  <article className="event-card" key={event.id}>
                    <div className={`event-image event-${event.category}`}>
                      <span className="event-category">{event.category}</span>
                      <img className="event-photo" src={event.image} alt={event.name} />
                    </div>
                    <div className="event-details">
                      <h3>{event.name}</h3>
                      <p>{event.description}</p>
                      <div className="event-info">
                        <span>📅 {event.date}</span>
                        <span>🕒 {event.time}</span>
                        <span>📍 {event.venue}</span>
                      </div>
                      <div className="event-footer">
                        <div className="price">
                          ₹{event.price}<small> / seat</small>
                        </div>
                        <button
                          className="primary-btn small-btn"
                          onClick={() => openBooking(event)}
                        >
                          Book Now
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="features">
              <div><span>🎫</span><h3>Easy Booking</h3><p>Reserve seats in a few simple steps.</p></div>
              <div><span>🔐</span><h3>Secure Records</h3><p>Bookings are saved through the backend.</p></div>
              <div><span>📱</span><h3>Digital Tickets</h3><p>Get a QR code for your booking reference.</p></div>
            </section>
          </>
        )}

        {page === "booking" && selectedEvent && user && (
          <section className="content-section">
            <button className="back-btn" onClick={backHome}>← Back to Events</button>

            <div className="booking-layout">
              <section className="panel">
                <span className="eyebrow">STEP 1</span>
                <h2>Select Your Seats</h2>
                <p className="muted">Choose the seats you want to reserve.</p>

                <div className="seat-legend">
                  <span><i className="seat-demo available-demo" /> Available</span>
                  <span><i className="seat-demo selected-demo" /> Selected</span>
                  <span><i className="seat-demo booked-demo" /> Booked</span>
                </div>

                <div className="screen">SCREEN / STAGE</div>
                {loadingSeats && <p className="muted">Loading seats...</p>}

                <div className="seat-grid">
                  {SEATS.map((seat) => {
                    const isBooked = bookedSeats.includes(seat.id);
                    const isSelected = selectedSeats.includes(seat.id);

                    return (
                      <button
                        key={seat.id}
                        type="button"
                        title={`${seat.id}${isBooked ? " — Booked" : isSelected ? " — Selected" : " — Available"}`}
                        disabled={isBooked || loadingSeats || loading}
                        className={`seat ${isBooked ? "booked" : isSelected ? "selected" : "available"}`}
                        onClick={() => toggleSeat(seat.id)}
                      >
                        {seat.number}
                      </button>
                    );
                  })}
                </div>
                <p className="muted seat-note">Green: available · Blue: selected · Red: booked</p>
              </section>

              <section className="panel">
                <span className="eyebrow">STEP 2</span>
                <h2>Booking Details</h2>

                <div className="selected-event-summary">
                  <img className="summary-photo" src={selectedEvent.image} alt={selectedEvent.name} />
                  <div>
                    <h3>{selectedEvent.name}</h3>
                    <p>{selectedEvent.date} · {selectedEvent.time}</p>
                    <p>{selectedEvent.venue}</p>
                  </div>
                </div>

                <form onSubmit={confirmBooking} className="booking-form">
                  <label htmlFor="customerName">Full Name</label>
                  <input
                    id="customerName"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Enter your full name"
                    required
                  />

                  <label htmlFor="bookingEmail">Email Address</label>
                  <input
                    id="bookingEmail"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                  />

                  <div className="bill">
                    <div><span>Ticket price</span><strong>₹{selectedEvent.price}</strong></div>
                    <div><span>Selected seats</span><strong>{selectedSeats.length}</strong></div>
                    <div><span>Seat numbers</span><strong>{selectedSeats.join(", ") || "None"}</strong></div>
                    <div className="total-row">
                      <span>Total Amount</span>
                      <strong>₹{selectedSeats.length * selectedEvent.price}</strong>
                    </div>
                  </div>

                  {message && <p className="error-message">{message}</p>}
                  <button className="primary-btn full-btn" type="submit" disabled={loading || loadingSeats}>
                    {loading ? "Booking..." : "Confirm Booking →"}
                  </button>
                </form>
              </section>
            </div>
          </section>
        )}

        {page === "ticket" && ticket && (
          <section className="content-section centered">
            <div className="success-icon">✓</div>
            <span className="eyebrow">BOOKING CONFIRMED</span>
            <h1>Your ticket is ready!</h1>
            <p className="muted">Keep your booking ID and QR code for reference.</p>

            <div className="digital-ticket">
              <div className="ticket-top">
                <span>🎟️ TicketHub</span><span className="status-pill">CONFIRMED</span>
              </div>
              <div className="ticket-event">
                <img
                  className="summary-photo"
                  src={EVENTS.find((item) => item.name === ticket.eventName)?.image || ""}
                  alt={ticket.eventName}
                />
                <div>
                  <h2>{ticket.eventName}</h2>
                  <p>{ticket.eventDate || "15 November 2026"}</p>
                  <p>{ticket.eventTime || "Event time"}</p>
                  <p>{ticket.venue || "Event venue"}</p>
                </div>
              </div>
              <div className="ticket-divider" />
              <div className="ticket-details-grid">
                <div><small>NAME</small><strong>{ticket.customerName}</strong></div>
                <div><small>SEATS</small><strong>{ticket.seats?.join(", ")}</strong></div>
                <div><small>BOOKING ID</small><strong>{ticket.bookingId || ticket._id}</strong></div>
                <div><small>TOTAL AMOUNT</small><strong>₹{ticket.totalAmount}</strong></div>
              </div>
              <div className="qr-container">
                <QRCodeSVG
                  value={JSON.stringify({
                    bookingId: ticket.bookingId || ticket._id,
                    eventName: ticket.eventName,
                    email: ticket.email,
                  })}
                  size={160}
                  level="M"
                />
                <p>Scan to view the booking reference</p>
              </div>
            </div>

            <div className="ticket-actions">
              <button className="primary-btn" onClick={() => window.print()}>Print Ticket</button>
              <button className="secondary-btn" onClick={showMyBookings}>My Bookings</button>
              <button className="secondary-btn" onClick={backHome}>Back to Home</button>
            </div>
          </section>
        )}

        {page === "bookings" && (
          <section className="content-section">
            <span className="eyebrow">YOUR RESERVATIONS</span>
            <h1>My Bookings</h1>
            <p className="muted">Bookings retrieved from your backend.</p>
            <div className="booking-list">
              {bookings.length === 0 ? (
                <div className="empty-state">
                  <span>🎫</span><h3>No bookings found</h3>
                  <p>Book an event to see your tickets here.</p>
                  <button className="primary-btn" onClick={backHome}>Explore Events</button>
                </div>
              ) : (
                bookings.map((booking, index) => (
                  <article className="booking-row" key={booking._id || index}>
                    <div className="booking-row-icon">🎟️</div>
                    <div className="booking-row-info">
                      <h3>{booking.eventName}</h3>
                      <p>{booking.customerName} · {booking.email}</p>
                      <p>Seats: {booking.seats?.join(", ")}</p>
                      <p>Booking ID: {booking.bookingId || booking._id}</p>
                    </div>
                    <div className="booking-row-price">
                      <strong>₹{booking.totalAmount}</strong>
                      <span className="status-pill">CONFIRMED</span>
                    </div>
                  </article>
                ))
              )}
            </div>
            <button className="secondary-btn" onClick={backHome}>← Back to Home</button>
          </section>
        )}

        {page === "verify" && (
          <section className="content-section centered">
            <div className="verify-icon">🔎</div>
            <span className="eyebrow">TICKETHUB VALIDATION</span>
            <h1>Verify Your Ticket</h1>
            <p className="muted">Enter the booking ID to check the booking record.</p>
            <form className="verify-form" onSubmit={verifyTicket}>
              <label htmlFor="verifyId">Booking ID</label>
              <input
                id="verifyId"
                value={verifyId}
                onChange={(event) => setVerifyId(event.target.value)}
                placeholder="Enter booking ID"
                required
              />
              {message && <p className="error-message">{message}</p>}
              <button className="primary-btn full-btn" type="submit">Verify Booking</button>
            </form>

            {verifiedBooking && (
              <div className="verified-card">
                <div className="success-icon">✓</div>
                <h2>Booking Found</h2>
                <p><strong>Event:</strong> {verifiedBooking.eventName}</p>
                <p><strong>Name:</strong> {verifiedBooking.customerName}</p>
                <p><strong>Email:</strong> {verifiedBooking.email}</p>
                <p><strong>Seats:</strong> {verifiedBooking.seats?.join(", ")}</p>
                <p><strong>Amount:</strong> ₹{verifiedBooking.totalAmount}</p>
                <p className="status-pill">RECORD FOUND</p>
              </div>
            )}
            <button className="secondary-btn" onClick={backHome}>← Back to Home</button>
          </section>
        )}
      </main>

      <footer className="footer">
        <button className="brand footer-brand" onClick={backHome}>🎟️ Ticket<span>Hub</span></button>
        <p>Book your moments. Keep your memories.</p>
        <small>© 2026 TicketHub · Online Ticket Booking System</small>
      </footer>
    </div>
  );
}
