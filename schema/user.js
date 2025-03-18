const { Schema, model } = require("mongoose");

const userSchema = new Schema({
  id: {
    type: Number,
    required: true,
  },
  first_name: {
    type: String,
    required: true,
  },
  username: {
    type: String,
  },
  role: {
    type: String,
    enum: {
      values: ["user", "admin"],
      message: "{VALUE} mavjud emas",
    },
    default: "user",
  },
  grades: {
    type: Number,
    default: 0,
  },
  resolved_tests: {
    type: Array,
    default: [],
  },
  selected_test: {
    type: String,
    default: "",
  },
});

module.exports = model("Users", userSchema);
