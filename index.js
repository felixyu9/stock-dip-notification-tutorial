const yf = require('yahoo-finance');
const moment = require('moment-timezone');
const AWS = require('aws-sdk');
AWS.config.update({
  region: 'us-east-1'
})
const ses = new AWS.SES();

const faangStocks = ['FB', 'AAPL', 'AMZN', 'MSFT', 'GOOGL'];
const maxPercentDip = 10.0;
const todayDate = moment().tz('America/New_York').format('YYYY-MM-DD');
const fiveDaysAgoDate = moment().tz('America/New_York').add(-5, 'days').format('YYYY-MM-DD');
const tomorrowDate = moment().tz('America/New_York').add(1, 'days').format('YYYY-MM-DD');
const emailSender = 'your-email@gmail.com';
const emailRecievers = ['your-email@gmail.com'];

exports.handler = async () => {
  const stockDipList = await retrieveStockDipList();
  if (stockDipList.length > 0) {
    await sendEmail(stockDipList);
  }
}

async function retrieveStockDipList() {
  const stockInfoList = [];
  for (const stock of faangStocks) {
    const priceHistory = await yf.historical({symbol: stock, from: fiveDaysAgoDate, to: tomorrowDate});
    const stockSummary = await yf.quote({symbol: stock, modules: ['summaryDetail']});
    const currentPrice = priceHistory[0].adjClose;
    const allTimeHigh = stockSummary.summaryDetail.fiftyTwoWeekHigh;
    const percentDip = Math.abs(currentPrice - allTimeHigh) / allTimeHigh * 100;
    if (percentDip > maxPercentDip) {
      stockInfoList.push({
        ticker: stock,
        currentPrice: currentPrice,
        allTimeHigh: allTimeHigh,
        percentDip: percentDip
      })
    }
  }
  return stockInfoList;
}

async function sendEmail(stockDipList) {
  const params = {
    Source: emailSender,
    Destination: {
      ToAddresses: emailRecievers
    },
    Message: {
      Subject: {
        Charset: 'UTF-8',
        Data: `FAANG Stocks Dip More than ${maxPercentDip} detected ${todayDate}`
      },
      Body: {
        Text: {
          Charset: 'UTF-8',
          Data: `Below are the FAANG stocks that dip more than ${maxPercentDip} from their 52 week high: \n\n${JSON.stringify(stockDipList)} \n\n-from my lambda`
        }
      }
    }
  }
  await ses.sendEmail(params).promise().then(response => {
    console.log(`Successfully sent email: ${response}`);
  }, error => {
    console.error('There is an error while sending email: ', error);
  });
}