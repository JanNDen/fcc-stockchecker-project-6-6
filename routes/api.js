'use strict';

// Connection
const mongoose = require("mongoose");
const db = mongoose.connect(process.env.DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const { Schema } = mongoose;

// Model
const stockSchema = new Schema({});
const StockModel = mongoose.model("stock", stockSchema);

module.exports = function (app) {

  app.route('/api/stock-prices')
    .get(function (req, res){
      
    });
    
};
