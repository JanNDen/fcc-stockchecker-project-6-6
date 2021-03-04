"use strict";
const fetch = require("node-fetch");

// Connection
const mongoose = require("mongoose");
const db = mongoose.connect(process.env.DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false
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
    let ip = [];
    if(like) ip.push((req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress || "").split(",")[0].trim());
    let formattedStocks = []; // Will be used for the final output
    let stocksCount = 1; // Will be used to wait in forEach for the right moment to spit out the final output
    let currentLoop = 1; // Detto, this is necessary due to async nature of mongoose -> the output has to be released from inside findOneAndUpdate

    // Prepare fetching stock data
    let promises = [];
    if (Array.isArray(stock)) {
      // If it's an array, we want to fetch two stocks at once
      stocksCount = 2;
      promises = [
        fetch("https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/" + stock[0] + "/quote"),
        fetch("https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/" + stock[1] + "/quote")
      ];
    } else promises = [fetch("https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/" + stock + "/quote")];

    // Fetch the data
    Promise.all(promises)
      .then(function (responses) {
        return Promise.all(responses.map((response) => response.json())); // Get a JSON object from each of the responses
      })
      .then(function (responseData) {
        responseData.forEach((item) => {

          // Thanks to findOneAndUpdate, we can update a stock with new IP (addToSet takes care of duplicates) and thanks to upsert:true it will automatically create a new stock if it doesn't exist yet
          StockModel.findOneAndUpdate(
            { stock: item.symbol },
            { $addToSet: { likes: ip } },
            { new: true, upsert: true },
            (err, updatedData) => {
              if (err || !updatedData) res.json({ error: "error updating stock" });
              else {

                // Gather all desired info about this stock
                formattedStocks.push({
                  stock: item.symbol,
                  price: item.latestPrice,
                  likes: updatedData.likes.length,
                });

                // If we looped over all stocks already
                if(stocksCount == currentLoop) {
                  // Prepare the final output based on whether we send info about one or two stocks
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
