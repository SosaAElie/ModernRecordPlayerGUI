const fs = require("fs")


function readCSVDatabase(){
	let dataString = fs.readFileSync("mockdata.csv", {encoding:"utf-8"})
	console.log(dataString)
	let dataArray = dataString.replace(/\n/g, ",").split(",")
	
	let col1 = []
	let col2 = []
	for(let i = 0; i < dataArray.length; i++){
		if (isEmptyString(dataArray[i])) continue
		if(i%2 >= 1){
			col2.push(dataArray[i])
		}
		else{
			col1.push(dataArray[i])
		}
	}
	writeCSVDatabase(col1, col2, "test", "data4")
	
}

function writeCSVDatabase(data1, data2, replace1, replace2){
	//Both have to be the same length arrays
	let merged = []
	for(let i = 0; i < data1.length; i++){

		if(data1[i] == replace1){
			merged.push(replace1+",")
			merged.push(replace2+"\n")
			continue
		}
		
		merged.push(data1[i]+",")
		merged.push(data2[i]+"\n")
		
	}
	fs.writeFileSync("mockdata.csv",merged.join(""))
}



function isEmptyString(str){
	if (str == '') return true
	else return false
}




readCSVDatabase()
