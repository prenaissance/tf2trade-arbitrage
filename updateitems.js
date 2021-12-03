const { promises: fs} = require("fs");
const axios = require("axios");
const SKU = require('tf2-sku');
let dates;

async function exists (path) {  
    try {
      await fs.access(path)
      return true
    } catch {
      return false
    }
}

function replacer(key, value) {
    if(value instanceof Map) {
      return {
        dataType: 'Map',
        value: Array.from(value.entries()),
      };
    } else {
      return value;
    }
  }

async function schema(forceupdate){
    try {
        if(!await exists("./lists/schema.json") || forceupdate){
            let resp=await axios.get("https://api.prices.tf/schema?appid=440");
            fs.writeFile("./lists/schema.json",JSON.stringify(resp.data)).then(()=>{
                console.debug("schema updated");
            });
        }else{
            console.debug("schema checked");
        }
    }
    catch(e){
        throw e;
    }
}

async function names(interval,forceupdate){
    try {
        if(!await exists("./lists/names.json") || forceupdate || Date.now()-dates.names> interval){
            let resp=await axios.get("https://api.prices.tf/overview");
            let hashnames= new Map(resp.data.items.map((v)=>{
                return [v.sku,v.name];
            }));
            await Promise.all([
                fs.writeFile("./lists/names.json",JSON.stringify(resp.data)),
                fs.writeFile("./lists/hashnames.json",JSON.stringify(hashnames,replacer))
            ]);
            dates.names= Date.now();
            console.debug("names updated");
        }else{
            console.debug("names checked");
        }
    }
    catch(e){
        throw e;
    }
}

async function prices(interval,forceupdate){
    try {
        if(!await exists("./lists/prices.json") || Date.now()-dates.prices> interval){// add || forceupdate if you want
            let resp=await axios.get("https://api.prices.tf/items?src=bptf&cur");
            let hashprices= new Map(resp.data.items.map((v)=>{
                return [v.sku,{
                    name:v.name,
                    source:v.source,
                    time:v.time,
                    buy:v.buy,
                    sell:v.sell
                }];
            }));
            await Promise.all([
                fs.writeFile("./lists/prices.json",JSON.stringify(resp.data)),
                fs.writeFile("./lists/hashprices.json",JSON.stringify(hashprices,replacer))
            ]);
            dates.prices= Date.now();
            console.debug("prices updated");
        }else{
            console.debug("prices checked");
        }
    }
    catch(e){
        throw e;
    }
}

async function tftrade(interval,forceupdate){
    try {
        if(!await exists("./lists/tftrade.json") || forceupdate || Date.now()-dates.prices> interval){
            let resp = await axios.post("https://tftrade.net/app/load_inv",{
                "who":"bots_all",
                "update":true,
                "Cookie":"django_language=en; currency=1; effects=0; paints=0; owner=1"
            });
            
            let items= resp.data.filter((v)=>{
                return (v.owner==null && v.spell1==null);
            }).map((v)=>{
                v.craftable= (v.name.includes("Uncraftable"))?false:true;
                v.killstreak= (v.name.includes("Killstreak"))?1:0;
                v.killstreak= (v.name.includes("Specialized Killstreak"))?2:v.killstreak;
                v.killstreak= (v.name.includes("Professional Killstreak"))?3:v.killstreak;
                return [SKU.fromObject(v), v.price];//some legacy code updated??
            });
            let hashtftrade= new Map();
            items.forEach((v)=>{//removes duplicates, lowest price kept
                if (hashtftrade.has(v[0])){
                    if (v[1]<hashtftrade.get(v[0])){
                        hashtftrade.set(v[0],v[1]);
                    }
                }else{
                    hashtftrade.set(v[0],v[1]);
                }
            });
            //console.table(items) //testing purposes
            await Promise.all([
                fs.writeFile("./lists/tftrade.json",JSON.stringify(resp.data)),
                fs.writeFile("./lists/hashtftrade.json",JSON.stringify(hashtftrade,replacer))
            ]);
            dates.tftrade= Date.now();
            console.debug("tftrade updated");
            //console.log(resp.data.length);
            //console.log(hashtftrade.size);
        }else{
            console.debug("tftrade checked");
        }
    }
    catch(e){
        throw e;
    }
}

module.exports={
    update: async function (interval, forceupdate){//interval in minutes
        interval= (interval === undefined)? 10*60*1000 : interval*60*1000;//default 10 minutes
        forceupdate = (forceupdate === undefined)? false : forceupdate//default wait for interval
        if(await exists("./lists/dates.json") ){
            dates= JSON.parse(await fs.readFile("./lists/dates.json"));
            console.debug(dates);
        }else{
            dates= {
                names: 0,
                prices: 0,
                tftrade: 0
            };
        }
        console.debug("started reading")
        await Promise.all([
            //schema(forceupdate), //not used currently
            //names(interval,forceupdate), //not used currently
            prices(interval,forceupdate),
            tftrade(interval,forceupdate)
        ]);
        fs.writeFile("./lists/dates.json",JSON.stringify(dates));
    }
}