//build a server
const dotenv=require("dotenv");
const helmet=require("helmet")
//dotenv
dotenv.config();
const express=require("express");
const bcrypt = require("bcrypt");
const jwt=require("jsonwebtoken");
const nodemailer=require("nodemailer")
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const transmailer = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

const secretkey=process.env.SECRET_KEY;
const port=process.env.PORT;
//s1-import the package to connect with mongodb
const mongoose=require("mongoose");
const app=express();
const cors = require('cors');                                                                        
app.use(cors({
  origin: "http://localhost:5173", 
  methods: ["GET", "POST", "PUT", "DELETE"],
}));
app.use(express.json())
app.use(helmet())

//s2 Estabilish the connection
async function connection()
{
 await mongoose.connect(process.env.MONGODB_URL)
  .then(()=>{
    console.log("connected to database")
  })
  .catch((err)=>{
    console.log(err)
  })
}


//s3=Create schemaa
let productSchema=
new mongoose.Schema({
    title:
    {
      type:String,
      required:true
    
    },
    price:
    {
      type:Number,
      required:true
    },
    image:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    }
})
    
//s4 Create a model
let Product=mongoose.model("Product",productSchema);



const {rateLimit}=require("express-rate-limit")
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
	ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
	// store: ... , // Redis, Memcached, etc. See below.
})
app.use(limiter)
//------------User Model------------
let userschema=new mongoose.Schema({

  username:{type:String},
  email:{type:String,required:true,unique:true},
  password:{type:String,required:true},

  isVerified:{type:Boolean,default:false},

  otp:String,
  otpExpires:Date

})
//create model
let userModel=mongoose.model("users",userschema)

function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}
//---API's----
//api-1 Store products in the database
app.post('/products',async(req,res)=>{
  try {
    const {title,price,image,description}=req.body
    let newProduct={title,price,image,description}
    await Product.create(newProduct)
    res.status(201).json({
      msg:"Product is added succesffully"
    })
    
  } catch (error) {
    res.json({
      msg:error.message
    })
    
  }
  
})
app.get('/products', async (req, res) => {
  try {
    const products = await Product.find();

    res.status(200).json({
      success: true,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: error.message
    });
  }
});

//api-1.2
app.post('/signup',async(req,res)=>
{
  try{
    
    const {username,email,password}=req.body;
     let existUser= await userModel.findOne({email})
    if(existUser){
      return res.status(400).json({
        msg:"User already exists"
      })
    }
    
     let hashedpassword=await bcrypt.hash(password,10)
     const otp=generateOTP();
    let newUser={username,email,password:hashedpassword,otp,otpExpires:Date.now()+5*60*1000}

     await transmailer.sendMail({
      from: `"Ecommerce" <${EMAIL_USER}>`,
      to: email,
      subject: "Verify your account",
      html: `
        <h2>Email Verification</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>Valid for 5 minutes</p>
      `
    });

    await userModel.create(newUser)
    res.status(201).json({
      msg:"User is added successfully and otp is successfully send to your mail please verify it"
    })
   
    // let hashedpassword=await bcrypt.hash(password,10)
  }
  catch(error){
    res.json({
      msg:error.message
    })
  }
})
//api for authentication
app.post('/signin',async(req,res)=>{
  try {

    const {email,password}=req.body;
    let userdetails= await userModel.findOne({email})
    if(!userdetails)
    {
      return res.status(400).json({
        msg:"user not found"
      })
      
    }
    if(!user.isVerifiend)
    {
          return res.status(403).json({
      msg: "Please verify your email first"
    });

    }
      //check password
      let checkPassword=await bcrypt.compare(password,userdetails.password)
      if(!checkPassword)
      {
        return res.status(400).json({
          msg:"Username & Password incorrect"
        })
      }
      //generate token
      let payload={email:email}//unique details
      let token= await jwt.sign(payload,secretkey,{expiresIn:"1h"})
     try{
      await transmailer.sendMail({
      from:`"My email" <${process.env.EMAIL_USER}>`,
      to:email,
      subject:"Login to our mail is successful",
      html: `
        <h2>Login Successful</h2>
        <p>Hello <b>${userdetails.username || "User"}</b>,</p>
        <p>You have successfully signed in to your account.</p>
        <p>If this wasn't you, please secure your account immediately.</p>
      `
    })
     
  }
   catch(mailErr)
    {
       console.log("Mail failed:", mailErr.message);
        res.status(200).json({
        msg:"Login successful",
        token:token
      })
    }
       
    res.status(200).json({
        msg:"Login successful",
        token:token
      })

    
    
  } catch (err) {
    res.json({
      msg:err.message
    })
    
  }
})
app.post('/verify-otp',async(req,res)=>
{
    const { email, otp } = req.body;

  const user = await userModel.findOne({ email });

  if (!user) {
    return res.status(400).json({ msg: "User not found" });
  }
if(otp!==user.otp|| user.otpExpires<Date.now())
{
  return res.status(400).json({msg:"Invalid or expired otp"})
}
user.isVerified=true
user.otp=null
user.otpExpires=null
await user.save();
res.json({
  msg:"Account verified successfully"
})

})
app.post('/forgetPassword',async(req,res)=>
{
  const {email}=req.body
  const user=await userModel.findOne({email})
    if (!user) {
    return res.status(400).json({ msg: "User not found" });
  }
  const otp=generateOTP();
  user.otp=otp;
  user.otpExpires=Date.now()+5*60*1000
  await user.save()

  await transmailer.sendMail({
    to: email,
    subject: "Reset Password OTP",
    html: `<h1>Your OTP is ${otp}</h1>`
  });

  res.json({ msg: "OTP sent to email" });

})
app.post("/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const user = await userModel.findOne({ email });

  if (!user || user.otp !== otp || user.otpExpires < Date.now()) {
    return res.status(400).json({ msg: "Invalid OTP" });
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.otp = null;
  user.otpExpires = null;

  await user.save();

  res.json({ msg: "Password reset successful" });
});




//api-2 Fetch all products
app.get('/products',async(req,res)=>
{
  try {
    let products=await Product.find({})
    res.status(200).json({
      products
    })
    
  } catch (error) {
    res.json({
      msg:error.message
    })
    
  }
})
//api-3 Delete a products
app.delete('/products/:id',async(req,res)=>
{
  try {
    let id=req.params.id;
    await Product.findByIdAndDelete(id)
    res.status(200).json({
      msg:"Product is deleted successfully"
    })
    
  } catch (error) {
    res.json({
      msg:error.message
    })
    
  }
})
//api-4 Update a product
app.put('/products/:id',async(req,res)=>
{
  try {
    let id=req.params.id;
    let {title,price,image,description}=req.body;
    await Product.findByIdAndUpdate(id,{title,price,image,description})
    res.status(200).json({
      msg:"Product is updated successfully"
    })
    
  } catch (error) {
    res.json({
      msg:error.message
    })
    
  }
})





// //route  
// app.get('/products',(req,res)=>{
// res.json({
//     products
// }) 
// })

//route
// app.post('/submitproduct',(req,res)=>{
//    let {id,title,price,image,description}=req.body;
//    let newProduct={
//     id,
//     title,
//     price,
//     image,
//     description
//    }
//     products.push(newProduct)
//     res.json({
//         msg:"Product is added succesffully"
//       })
  
// })

async function startServer() {
  await connection();

  app.listen(port,() => {
    console.log(`Server running on port ${port}`);
  });
}

startServer();
