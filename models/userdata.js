const mongoose = require('mongoose');

const userDataSchema = new mongoose.Schema({
  username: String,
  strategies: [String],
  captions: [String],
  plans: [String],
});

// ✅ Prevent model overwrite error
const UserData = mongoose.models.UserData || mongoose.model('UserData', userDataSchema);

module.exports = UserData;
