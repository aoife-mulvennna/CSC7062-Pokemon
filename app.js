const express = require("express");
const app = express();

const mysql = require('mysql2');

app.set('view engine', 'ejs');

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

const cookieParser = require('cookie-parser');
const sessions = require('express-session');

const oneHour = 1000 * 60 * 60 * 1;

app.use(cookieParser());

app.use(sessions({
   secret: "mypokemon12",
   saveUninitialized: true,
   cookie: { maxAge: oneHour },
   resave: false
}));


const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'pokemon',
    port: '8889'
});

// db.connect((err) => {
//     if (err) throw err;
// });


// renders main view, pokemon logo, and background images
app.get('/', (req, res) => {

    res.render('main', { logoPath: 'Pokemon_Logo.png', backgroundPath: 'background-2.png' });

});

app.get('/view-cards', (req, res) => {
    const query = `
    SELECT pc.pokemon_name, pt.pokemon_type_name, pc.url_img, pc.hp, ps.pokemon_stage_name, pc.attack, pc.rarity, pc.weakness, psn.pokemon_set_name, pc.evolve_from 
    FROM pokemon_card pc 

    INNER JOIN pokemon_type pt ON pt.pokemon_type_id = pc.pokemon_type_id
    INNER JOIN pokemon_stage ps ON ps.pokemon_stage_id = pc.pokemon_stage_id
    INNER JOIN pokemon_set psn ON psn.pokemon_set_id = pc.pokemon_set_id;`

    db.query(query, (err, results) => {

        if (err) throw err;

        res.render('view-cards', { cards: results, logoPath: 'Pokemon_Logo.png' });
    });
});


// renders home view 
app.get('/home', (req, res) => {
    const sessionobj = req.session;
   
    if(sessionobj.authen){
        const uid = sessionobj.authen;
        const user = `SELECT * FROM user WHERE user_id = "${uid}"`;

        db.query(user, (err, row)=>{
            const firstrow = row[0];
            res.render('home', { logoPath: 'Pokemon_Logo.png', userdata:firstrow});
        })
   
    } else{
        res.send("Acccess Denied");
    }

});

// renders login
app.get('/login', (req, res) => {

    res.render('login', { logoPath: 'Pokemon_Logo.png', backgroundPath: 'background-2.png' });

});




app.post('/', (req, res) => {
    const username = req.body.usernameField;
// const password = req.body.passwordField;

    const checkuser = `SELECT * FROM user WHERE username = "${username}"`;
    db.query(checkuser, (err, rows) => {
        if (err) throw err;
        const numRows = rows.length;

        if (numRows > 0) {
            const sessionobj = req.session;  
            sessionobj.authen = rows[0].id; 
            res.redirect('/home');

        } else {
            res.redirect('/');

        }

    });
});

// renders sign up
app.get('/sign-up', (req, res) => {

    res.render('sign-up', { logoPath: 'Pokemon_Logo.png', backgroundPath: 'background-2.png' });

});

app.post('/sign-up', (req,res) => {

});

app.listen(3000, () => {
    console.log('Server on port 3000');
});