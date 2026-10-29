
const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
  },
  eventName: {
    type: String,
    required: true,
    trim: true,
  },
  seats :{
    type: [String],
    required: true,
    validate: {
      validator: (seats) => seats.length > 0,
      message: "At least one seat must be selected.",
    },
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 1,
  },
  bookingDate: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Booking", bookingSchema);
