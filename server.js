const express = require("express")
const app = express()
const http = require("http")
const { Server } = require("socket.io")
const server = http.createServer(app)
const cors = require("cors")
const fs = require("fs")
const path = require("path")
const connectDB = require("./Config/db")
const LabTest = require("./Models/LabTest")
const bodyParser = require("body-parser")
const moment = require("moment")
const bcrypt = require("bcrypt")
require("dotenv").config()
app.use(express.static(path.join(__dirname, "public")))
const PORT = process.env.PORT
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})
connectDB()
app.get("/hash", async (req, res) => {
  const hashedPassword = await bcrypt.hash(`%24nC%40202311M%40S`, 10)
  res.json(hashedPassword)
})
app.get("/", async (req, res) => {
  const fileAll = await LabTest.find({})

  res.json({
    msg: "Hello",
    file: fileAll,
  })
})

app.get("/files", async (req, res) => {
  const allFiles = await LabTest.find({}).sort({ mtimeMs: -1 })
  if (allFiles) {
    res.json({
      err: false,
      files: allFiles,
    })
  }
})

const calDuration = (create, modified, oldDuration, status) => {
  const start = moment(create, "D/M/YYYY HH:mm:ss").local("th")
  const end = moment(modified, "D/M/YYYY HH:mm:ss").local("th")
  const duration = end.diff(start)
  console.log("status", status)

  return status == "ON"
    ? parseInt(duration) + parseInt(oldDuration)
    : parseInt(oldDuration)
}
const getFileAll = async (files) => {
  const sortedFiles = files.sort((a, b) => b.mtimeMs - a.mtimeMs)
  console.log(sortedFiles)
  try {
    const sortedFiles = files.sort((a, b) => b.mtimeMs - a.mtimeMs)
    if (sortedFiles.length == files.length) {
      for (let index = 0; index < sortedFiles.length; index++) {
        let getFile = await LabTest.find({
          filename: sortedFiles[index].filename,
        })
        if (getFile[0].Diff != sortedFiles[index].diff) {
          const updateFile = await LabTest.findByIdAndUpdate(getFile[0]._id, {
            Diff: sortedFiles[index].diff,
            dateModified: sortedFiles[index].mtime,
            size: sortedFiles[index].size,
            status: getFile[0].status == "ON" ? "OFF" : "ON",
            duration:
              getFile[0].duration == 0
                ? sortedFiles[index].duration
                : calDuration(
                    getFile[0].dateModified,
                    sortedFiles[index].mtime,
                    getFile[0].duration,
                    getFile[0].status
                  ),
          })
          console.log("Updated", updateFile)
        } else {
          // console.log("เท่า", getFile[0]._id)
        }
      }
    } else {
      console.log("Check your file on local and Mongo")
    }
  } catch (err) {
    console.log(err)
  }
}
const checkFileDb = async (files) => {
  const sortedFiles = files.sort((a, b) => b.mtimeMs - a.mtimeMs)
  sortedFiles?.map(async (file, index) => {
    let response = await LabTest.find({ filename: file.filename }).sort({
      mtimeMs: -1,
    })
    if (response.length == 0) {
      let storeIn = new LabTest({
        filename: file.filename,
        dateCreate: file.birthtime,
        dateModified: file.mtime,
        typeFile: file.type,
        Diff: file.diff,
        size: file.size,
        unitTest: file.unitTest,
        mtimeMs: file.mtimeMs,
        status: "ON",
        duration: file.duration,
        isFirst: true,
        date: file.birthtime.split(" ")[0],
      })
      await storeIn.save()
      if (index + 1 === files.length) {
        setTimeout(async () => {
          await getFileAll(files)
        }, 500)
      }
    } else {
      await getFileAll(files)
    }
  })
}

// API HTTP REQUEST TO CHECK STATUS
app.get("/files/:date", (req, res) => {
  const date = req.params.date
  // const dateNow = moment(new Date()).format("YYYY_MM_DD")?.split("T")[0]
  const folderPathRoot = "/TestData/TestDataSave"
  const covertDate = (create, modified) => {
    const start = moment(create, "D/M/YYYY HH:mm:ss")
    const end = moment(modified, "D/M/YYYY HH:mm:ss")

    // Calculate the difference
    const duration = moment.duration(end.diff(start))

    // Get days, hours, and seconds
    const days = duration.days()
    const hours = duration.hours()
    const seconds = duration.seconds()
    const minutes = duration.minutes()
    return `${days} days, ${hours} hours, ${minutes} minutes ${seconds} seconds`
  }
  fs.readdir(folderPathRoot, (err, files) => {
    if (err) {
      res.json({ err: true, msg: err })
    }
    if (files?.length > 0) {
      let dateFolder = files.filter((val) => val == date)
      if (dateFolder?.length > 0) {
        const folderPath = path.join(
          __dirname,
          `../TestData/TestDataSave/${date}/TestProjectData`
        )
        fs.readdir(folderPath, (err, files) => {
          if (err) {
            console.error("Error reading folder:", err)
            res.status(500).send("Internal Server Error")
            return
          }

          const statPromises = files.map((element, index) => {
            console.log(element)
            return new Promise((resolve, reject) => {
              const filePath = path.join(folderPath, element)
              fs.stat(filePath, async (err, stats) => {
                if (err) {
                  reject(err)
                } else {
                  console.log("stats", stats)
                  resolve({
                    filename: element,
                    type: element.split(".")[1],
                    unitTest: element.split("_")[0],
                    birthtime: stats.birthtime,
                    mtime: stats.mtime,
                    atime: stats.atime,
                    atimeMs: stats.atimeMs,
                    mtimeMs: stats.mtimeMs,
                    diff: covertDate(
                      new Date(stats.birthtime.toLocaleString()),
                      new Date(stats.mtime.toLocaleString())
                    ),
                    size: stats.size,
                  })
                }
              })
            })
          })

          Promise.all(statPromises)
            .then((filesWithStats) => {
              console.log(filesWithStats)
              const formattedFiles = filesWithStats.map((fileStats) => {
                return {
                  // filename: fileStats.filename.split(" ")[1].substring(1),
                  filename: fileStats.filename,
                  type: fileStats.filename.split(".")[1],
                  unitTest: fileStats.filename.split("_")[0],
                  birthtime: fileStats.birthtime.toLocaleString(),
                  mtime: fileStats.mtime.toLocaleString(),
                  atime: fileStats.atime.toLocaleString(),
                  atimeMs: fileStats.atimeMs,
                  mtimeMs: fileStats.mtimeMs,
                  diff: covertDate(
                    new Date(fileStats.birthtime.toLocaleString()),
                    new Date(fileStats.mtime.toLocaleString())
                  ),
                  size: fileStats.size,
                }
              })

              const sortedFiles = formattedFiles.sort(
                (a, b) => b.mtimeMs - a.mtimeMs
              )
              const sortedFilesFilter = sortedFiles.filter(
                (x) => x.type == "Testpro"
              )

              checkFileDb(sortedFilesFilter)

              res.json(sortedFilesFilter)

              // io.emit("results", sortedFiles) //Socket for Client
            })
            .catch((error) => {
              console.error("Error getting file stats:", error)
              res.status(500).send("Internal Server Error")
            })
        })
      } else {
        res.json({
          msg: "Not found!",
        })
      }
    }
  })
})

// Function Check Status
const CheckStatusRun = (dateCheck) => {
  const folderPathRoot = "../TestData/TestDataSave"
  const covertDate = (create, modified) => {
    const start = moment(create, "D/M/YYYY HH:mm:ss").local("th")
    const end = moment(modified, "D/M/YYYY HH:mm:ss").local("th")

    // Calculate the difference
    const duration = moment.duration(end.diff(start))
    // Get days, hours, and seconds
    const days = duration.days()
    const hours = duration.hours()
    const seconds = duration.seconds()
    const minutes = duration.minutes()
    return `${days} days, ${hours} hours, ${minutes} minutes ${seconds} seconds`
  }
  const covertDuration = (create, modified) => {
    const start = moment(create, "D/M/YYYY HH:mm:ss").local("th")
    const end = moment(modified, "D/M/YYYY HH:mm:ss").local("th")
    const duration = end.diff(start)

    console.log("start", duration)
    return duration
  }
  fs.readdir(folderPathRoot, (err, isFiles) => {
    if (err) {
      console.log(err)
    }
    if (isFiles?.length > 0) {
      let dateFolder = isFiles.filter((val) => val == dateCheck)
      if (dateFolder?.length > 0) {
        const folderPath = path.join(
          __dirname,
          `../TestData/TestDataSave/${dateCheck}/TestProjectData`
        )
        fs.readdir(folderPath, (err, files) => {
          if (err) {
            console.log(err)
          }
          const statPromises = files.map((element, index) => {
            return new Promise((resolve, reject) => {
              const filePath = path.join(folderPath, element)
              fs.stat(filePath, async (err, stats) => {
                if (err) {
                  reject(err)
                } else {
                  resolve({
                    filename: element,
                    type: element.split(".")[1],
                    unitTest: element.split("_")[0],
                    birthtime: stats.birthtime.toLocaleString(),
                    mtime: stats.mtime,
                    atime: stats.atime,
                    atimeMs: stats.atimeMs,
                    mtimeMs: stats.mtimeMs,
                    diff: covertDate(
                      stats.birthtime.toLocaleString(),
                      stats.mtime.toLocaleString()
                    ),
                    duration: covertDuration(
                      stats.birthtime.toLocaleString(),
                      stats.mtime.toLocaleString()
                    ),
                    size: stats.size,
                  })
                }
              })
            })
          })

          Promise.all(statPromises)
            .then((filesWithStats) => {
              const formattedFiles = filesWithStats.map((fileStats) => {
                return {
                  // filename: fileStats.filename.split(" ")[1].substring(1),
                  filename: fileStats.filename,
                  type: fileStats.filename.split(".")[1],
                  unitTest: fileStats.filename.split("_")[0],
                  birthtime: fileStats.birthtime.toLocaleString(),
                  mtime: fileStats.mtime.toLocaleString(),
                  atime: fileStats.atime.toLocaleString(),
                  atimeMs: fileStats.atimeMs,
                  mtimeMs: fileStats.mtimeMs,
                  diff: covertDate(
                    fileStats.birthtime.toLocaleString(),
                    fileStats.mtime.toLocaleString()
                  ),
                  duration: covertDuration(
                    fileStats.birthtime.toLocaleString(),
                    fileStats.mtime.toLocaleString()
                  ),
                  size: fileStats.size,
                }
              })

              const sortedFiles = formattedFiles.sort(
                (a, b) => b.mtimeMs - a.mtimeMs
              )
              const sortedFilesFilter = sortedFiles.filter(
                (x) => x.type == "Testpro"
              )

              checkFileDb(sortedFilesFilter)

              // res.json(sortedFilesFilter)

              // io.emit("results", sortedFiles) //Socket for Client
            })
            .catch((error) => {
              console.error("Error getting file stats:", error)
              res.status(500).send("Internal Server Error")
            })
        })
      } else {
        console.log("Folder not haved!")
      }
    }
  })
}
// const dateNow = moment(new Date()).format("YYYY_MM_DD")
const emitFile = async (date) => {
  const dateNow = moment(new Date()).format("YYYY_MM_DD")?.split("T")[0]
  CheckStatusRun(dateNow)
  const allFileOnMongo = await LabTest.find({}).sort({ mtimeMs: -1 })
  const allFileByDate = await LabTest.find({ date: date }).sort({ mtimeMs: -1 })
  setTimeout(() => {
    if (allFileOnMongo) {
      io.emit("results", allFileOnMongo)
      console.log("Send to Client")
    } else {
      io.emit("results", [])
    }

    if (allFileByDate) {
      io.emit("resultsByDate", allFileByDate)
    } else {
      io.emit("resultsByDate", [])
    }
  }, 500)
}

setInterval(() => {
  let date = moment(new Date()).format().split("T")[0]
  const year = parseInt(date.split("-")[0]) + 543
  const m = parseInt(date.split("-")[1])
  const d = parseInt(date.split("-")[2])
  let dateThai = `${d}/${m}/${year}`

  emitFile(dateThai)
}, 5000)

io.on("connection", (socket) => {
  // console.log("User connection");
  socket.on("disconnect", () => {
    // console.log("User disconnection");
  })
})

server.listen(PORT, () => {
  console.log("Server running on port 5000")
})
