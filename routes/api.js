"use strict";
const fetch = require("node-fetch");

// Connection
const mongoose = require("mongoose");
const db = mongoose.connect(process.env.DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const { Schema } = mongoose;

// Model
const stockSchema = new Schema({
  stock: String,
  likes: [String],
});
const StockModel = mongoose.model("stock", stockSchema);

module.exports = function (app) {

  app.route("/api/stock-prices").get(function (req, res) {

    // Get variables
    const { stock, like } = req.query;
    let ip = (req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress || "").split(",")[0].trim();
    if(!like) ip = "";
    let formattedStocks = [];
    let stocksCount = 1;
    let currentLoop = 1;

    // Prepare fetching stock data
    let promises = [];
    if (Array.isArray(stock)) {
      stocksCount = 2;
      promises = [fetch("https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/" + stock[0] + "/quote"), fetch("https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/" + stock[1] + "/quote")];
    } else promises = [fetch("https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/" + stock + "/quote")];

    // Fetch the data
    Promise.all(promises)
      .then(function (responses) {
        return Promise.all(responses.map((response) => response.json())); // Get a JSON object from each of the responses
      })
      .then(function (responseData) {
        responseData.forEach((item) => {


          StockModel.findOneAndUpdate(
            { stock: item.symbol },
            { $addToSet: { likes: ip } },
            { new: true, upsert: true },
            (err, updatedData) => {
              if (err || !updatedData) {
                console.log("error updating stock", err);
                res.json({ error: "error updating stock" });
              } else {
                console.log("stock updated", updatedData);
                formattedStocks.push({
                  stock: item.symbol,
                  price: item.latestPrice,
                  likes: updatedData.likes.length,
                });

                if(stocksCount == currentLoop) {
                  if (formattedStocks.length === 1)
                    res.json({ stockData: formattedStocks[0] });
                  else {
                    const rel_likes = formattedStocks[0].likes - formattedStocks[1].likes;
                    formattedStocks[0].rel_likes = rel_likes;
                    formattedStocks[1].rel_likes = 0 - rel_likes;
                    delete formattedStocks[0].likes;
                    delete formattedStocks[1].likes;
                    res.json({ stockData: formattedStocks });
                  }
                } else currentLoop++;
              }
            }
          );
        });
      })
      .catch(function (error) {
        console.log(error);
      });
  });
};
