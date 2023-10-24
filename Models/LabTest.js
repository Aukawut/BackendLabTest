const mongoose = require("mongoose")
const labTestSchema = new mongoose.Schema(
  {
    filename: { type: String },
    dateCreate: { type: String },
    dateModified: { type: String },
    typeFile: { type: String },
    Diff: { type: String },
    size: { type: Number },
    unitTest: { type: String },
    status: { type: String },
    mtimeMs: { type: Number },
    date:{type:String},
    duration:{type:Number},
    isFirst:{type:Boolean}
  },
  { timestamps: true }
)
module.exports = mongoose.model("LabTestB6", labTestSchema)
