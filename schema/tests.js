const { Schema, model } = require("mongoose");

const testSchema = new Schema({
  test_number: {
    type: Number,
    unique: true,
    required: true,
  },
  tests: {
    type: String,
    default: "",
  },
  answers: {
    type: String,
    default: "",
  },
  resolved_users: {
    type: Array,
    default: [],
  },
});

module.exports = model("Tests", testSchema);
