
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const Booking = require("./models/Booking");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", require("./routes/auth"));

// Home route
app.get("/", (req, res) => {
  res.send("TicketHub Backend is Running!");
});

// Get all bookings
app.get("/api/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find().sort({
      bookingDate: -1,
    });

    return res.status(200).json(bookings);
  } catch (error) {
    console.error("Fetch bookings error:", error.message);

    return res.status(500).json({
      message: "Could not retrieve bookings.",
    });
  }
});

// Get booked seats for a specific event
app.get("/api/booked-seats/:eventName", async (req, res) => {
  try {
    const eventName = req.params.eventName;

    const bookings = await Booking.find({
      eventName,
    }).select("seats -_id");

    const bookedSeats = [
      ...new Set(bookings.flatMap((booking) => booking.seats)),
    ];

    return res.status(200).json({
      eventName,
      bookedSeats,
    });
  } catch (error) {
    console.error("Fetch booked seats error:", error.message);

    return res.status(500).json({
      message: "Could not retrieve booked seats.",
    });
  }
});

// Create a booking
app.post("/api/bookings", async (req, res) => {
  try {
    const {
      customerName,
      email,
      eventName,
      seats,
      totalAmount,
    } = req.body;

    // Validate input
    if (
      typeof customerName !== "string" ||
      !customerName.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof eventName !== "string" ||
      !eventName.trim() ||
      !Array.isArray(seats) ||
      seats.length === 0 ||
      !seats.every(
        (seat) => typeof seat === "string" && seat.trim()
      ) ||
      new Set(seats).size !== seats.length ||
      typeof totalAmount !== "number" ||
      !Number.isFinite(totalAmount) ||
      totalAmount <= 0
    ) {
      return res.status(400).json({
        message: "Please provide valid booking details.",
      });
    }

    const cleanEventName = eventName.trim();
    const cleanSeats = seats.map((seat) => seat.trim());

    // Check whether any selected seats are already booked
    const existingBookings = await Booking.find({
      eventName: cleanEventName,
      seats: { $in: cleanSeats },
    }).select("seats -_id");

    const alreadyBooked = [
      ...new Set(
        existingBookings.flatMap((booking) => booking.seats)
          .filter((seat) => cleanSeats.includes(seat))
      ),
    ];

    if (alreadyBooked.length > 0) {
      return res.status(409).json({
        message: `These seats are already booked: ${alreadyBooked.join(", ")}. Please select other seats.`,
        bookedSeats: alreadyBooked,
      });
    }

    const booking = await Booking.create({
      customerName: customerName.trim(),
      email: email.trim(),
      eventName: cleanEventName,
      seats: cleanSeats,
      totalAmount,
    });

    console.log("Booking saved:", booking._id);

    return res.status(201).json({
      message: "Booking saved successfully!",
      booking,
    });
  } catch (error) {
    console.error("Booking error:", error.message);

    return res.status(500).json({
      message: "Could not save booking.",
    });
  }
});

// Verify a ticket using its booking ID
app.get("/api/verify/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        valid: false,
        message: "Invalid booking ID format.",
      });
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        valid: false,
        message: "Ticket not found.",
      });
    }

    return res.status(200).json({
      valid: true,
      message: "Valid ticket! Booking found.",
      booking: {
        id: booking._id,
        customerName: booking.customerName,
        eventName: booking.eventName,
        seats: booking.seats,
        totalAmount: booking.totalAmount,
        bookingDate: booking.bookingDate,
      },
    });
  } catch (error) {
    console.error("Ticket verification error:", error.message);

    return res.status(500).json({
      valid: false,
      message: "Unable to verify ticket right now.",
    });
  }
});

// Connect to MongoDB and start server
async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from the backend .env file.");
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB Connected Successfully!");

    const port = process.env.PORT || 5000;

    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Backend startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
