const express = require("express");
const app = express();

const mysql = require('mysql2');

// for encrypting passwords
const bcrypt = require('bcrypt');

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

app.get('/view-collection', (req, res) => {
    let sess_obj = req.session;
    const uid = sess_obj.authen;
    const query = ` SELECT user.username, pokemon_card.* FROM user INNER JOIN collection ON user.user_id = collection.user_id
INNER JOIN card_collection ON collection.collection_id = card_collection.collection_id
INNER JOIN pokemon_card ON card_collection.card_id = pokemon_card.pokemon_card_id WHERE user.user_id = "${uid}"`;

    db.query(query, (err, results) => {

        if (err) throw err;
        const username = results.length > 0 ? results[0].username : '';
        // res.render('view-collection', { cards: results, logoPath: 'Pokemon_Logo.png' });
        res.render('view-collection', { cards: results, username: username, logoPath: 'Pokemon_Logo.png' });

    });
});

// renders home view 
app.get('/home', (req, res) => {
    // const sessionobj = req.session;
    let sess_obj = req.session;
    console.log(sess_obj);
    if (sess_obj.authen) {
        const uid = sess_obj.authen;
        const user = `SELECT * FROM user WHERE user_id = "${uid}"`;

        db.query(user, (err, row) => {
            const firstrow = row[0];
            res.render('home', { logoPath: 'Pokemon_Logo.png', userdata: firstrow });
        });
    } else {
        res.send("Acccess Denied");
    }
});

// renders login
app.get('/login', (req, res) => {

    res.render('login', { logoPath: 'Pokemon_Logo.png', backgroundPath: 'background-2.png' });

});




app.post('/login', (req, res) => {
    const { usernameField, passwordField } = req.body;

    const query = `SELECT * FROM user WHERE username = '${usernameField}'`;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error querying database: ', err);
            res.status(500).send('Internal Sever Error');
            return;
        }

        if (results.length === 0) {
            res.status(401).send('Username or password is incorrect');
            return;
        }

        // comparing the hashed password with the input password
        const hashedPassword = results[0].password;

        bcrypt.compare(passwordField, hashedPassword, (bcryptErr, isMatch) => {
            if (bcryptErr) {
                console.error('Error comparing passwords:', bcryptErr);
                res.status(500).send('Internal Sever Error');
                return;
            }

            // if the passwords match, it means they can log in!
            if (isMatch) {
                let sess_obj = req.session;
                sess_obj.authen = results[0].user_id;
                res.redirect('/home');
            } else {
                res.status(401).send('Username or password is incorrect');
            }
        });
    });
});


// renders sign up
app.get('/sign-up', (req, res) => {

    res.render('sign-up', { logoPath: 'Pokemon_Logo.png', backgroundPath: 'background-2.png' });

});

// allows users to create an account and inserts them into the database
app.post('/sign-up', (req, res) => {

    const email = req.body.emailField;
    const userName = req.body.usernameField;
    const age = req.body.ageField;
    const password = req.body.passwordField;

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err);
            res.send('An error occured while creating the account.');
        } else {
            const query = `INSERT INTO user (username, password, email_address, age) VALUES ('${userName}', '${hashedPassword}', '${email}', '${age}')`;

            db.query(query, (err, result) => {
                if (err) {
                    // handle error
                    console.error("Error inserting user:", err);
                    res.send("An error occured while creating the account.");
                } else {
                    // res.send("Account created successfully");
                    res.redirect('/home');// later consider redirecting to log in!
                }
            });
        }
    });

});

app.listen(3000, () => {
    console.log('Server on port 3000');
});