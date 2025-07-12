import express from 'express';
import corsOptions from './config/CorsOption.js';
import dbconnect from './config/DBConnect.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import AdminLogin from './routes/AdminLogin.js'
import Label from './routes/api/Label.js';
import Category from './routes/api/Categroy.js';
import Product from './routes/api/Product.js';
import Order from './routes/api/Order.js';
import User from './routes/api/User.js';
import UserAuth from './routes/UserAuth.js';
import BuyProduct from './routes/api/BuyProduct.js';

const app = express();
app.use(cors(corsOptions));


// connect database
dbconnect.connect()
  .then(() => console.log('Database connected successfully'))
  .catch((err) => {
    console.error('Database connection failed', err);
  });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


app.use('/',AdminLogin);
app.use('/',Label);
app.use('/categroy',Category);
app.use('/product',Product);
app.use('/order',Order);
app.use('/auth',UserAuth);
app.use('/user',User);
app.use('/buy',BuyProduct);

app.get('/',(req,res)=>{
    res.send({status:'up'})
})


app.listen(8000, () => {
  console.log('Server is running on http://localhost:8000');
});
