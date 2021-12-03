const { promises: fs } = require("fs");
const axios = require("axios");
const updateitems= require("./updateitems");
//const yargs = require('yargs');
const updateinterval= 10;//minutes between updates
const keyprice = 61;//for now constant
//const bptfkey = 59.11;
let myArgs = process.argv.slice(2);
const force = (myArgs[1]!== undefined)? myArgs[1] : false;//default wait interval

function reviver(key, value) {
    if(typeof value === 'object' && value !== null) {
      if (value.dataType === 'Map') {
        return new Map(value.value);
      }
    }
    return value;
  }

async function main(){
    let hashprices,hashtftrade;
    await updateitems.update(updateinterval,force);
    await Promise.all([//hashmaps
        //schema= await fs.readFile("./lists/schema.json"),
        hashtftrade= JSON.parse(await fs.readFile("./lists/hashtftrade.json"),reviver),
        hashprices= JSON.parse(await fs.readFile("./lists/hashprices.json"),reviver),
        
    ]);
    const bptfkey= hashprices.get("5021;6").buy.metal;//parsed key price
    console.log(`tftrade size: ${hashtftrade.size}`);
    console.log(`prices.tf size: ${hashprices.size}`);
    let prices=[];
    hashtftrade.forEach((v,key)=>{
      if (hashprices.has(key))
        prices.push([hashprices.get(key).name,key,v,hashprices.get(key).sell,hashprices.get(key).buy,
          parseFloat((v*0.92-(hashprices.get(key).sell.keys*bptfkey+hashprices.get(key).sell.metal)).toFixed(2)),//8% fee
          ((v*0.92-(hashprices.get(key).sell.keys*bptfkey+hashprices.get(key).sell.metal))/
          v*100).toFixed(2),
          parseFloat(((hashprices.get(key).buy.keys*bptfkey+hashprices.get(key).buy.metal)-v).toFixed(2)),
          (((hashprices.get(key).buy.keys*bptfkey+hashprices.get(key).buy.metal)-v)/v*100).toFixed(2)]);//percentage gain buying
    });
    switch (myArgs[0]){
      case "buy":
        prices.sort((a,b)=>{
          return a[7]-b[7];
        });
        break;
      case "buyp":
        prices.sort((a,b)=>{
          return a[8]-b[8];
        });
        break;
      case "sell":
        prices.sort((a,b)=>{
          return a[5]-b[5];
        });
        break;
      case "sellp":
        prices.sort((a,b)=>{
          return a[6]-b[6];
        });
        break;
      default:
        prices.sort((a,b)=>{
          return a[6]-b[6];
        });
    }
    console.table(prices);
}
main();