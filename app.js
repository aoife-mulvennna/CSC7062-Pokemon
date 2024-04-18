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

function isAuthenticated(req, res, next) {
    if (req.user) {
        // User is authenticated, proceed with the request
        return next();
    } else {
        // User is not authenticated, redirect to guest access page
        res.redirect('/guest-access');
    }
}


// renders main view, pokemon logo, and background images
app.get('/', (req, res) => {

    res.render('main', { logoPath: 'Pokemon_Logo.png', backgroundPath: 'background-2.png' });

});

app.get('/view-cards', (req, res) => {

    let sess_obj = req.session;
    const uid = sess_obj.authen;

    const getCardsQuery = `
    SELECT pc.pokemon_card_id, pc.pokemon_name, pt.pokemon_type_name, pc.url_img, pc.hp, ps.pokemon_stage_name, pc.attack, r.rarity_name, pc.weakness, psn.pokemon_set_name, pc.evolve_from 
    FROM pokemon_card pc 

    INNER JOIN pokemon_type pt ON pt.pokemon_type_id = pc.pokemon_type_id
    INNER JOIN pokemon_stage ps ON ps.pokemon_stage_id = pc.pokemon_stage_id
    INNER JOIN pokemon_set psn ON psn.pokemon_set_id = pc.pokemon_set_id
    INNER JOIN rarity r ON r.rarity_id = pc.rarity_id;`


    db.query(getCardsQuery, (err, cardsResults) => {

        if (err) {
            console.error("Error fetching card data:", err);
            res.status(500).send("Internal Server Error");
            return;
        }

        const getUserQuery = `SELECT u.username, pp.profile_picture_url FROM 
        user u INNER JOIN profile_picture pp ON pp.profile_picture_id = u.profile_picture_id 
        WHERE u.user_id = ${uid}`

        db.query(getUserQuery, (err, userResults) => {
            if (err) {
                console.error("Error fetching user data:", err);
                res.status(500).send("Internal Server Error");
                return;
            }

            if (userResults.length === 0) {
                res.status(404).send("User not found");
                return;
            }

            const userData = userResults[0];
            username = userData.username;
            const picUrl = userData.profile_picture_url;
            res.render('view-cards', { cards: cardsResults, logoPath: 'Pokemon_Logo.png', username: username, picUrl: picUrl });
        })

    });
});

app.get('/view-collection', (req, res) => {
    let sess_obj = req.session;
    const uid = sess_obj.authen;
    const query = ` SELECT u.username, pc.*, u.profile_picture_id, ps.pokemon_stage_name, psn.pokemon_set_name, pt.pokemon_type_name, pp.*, r.rarity_name
    FROM user u
    INNER JOIN collection c ON u.user_id = c.user_id
    INNER JOIN card_collection cc ON c.collection_id = cc.collection_id
    INNER JOIN pokemon_card pc ON cc.card_id = pc.pokemon_card_id 
    INNER JOIN pokemon_type pt ON pt.pokemon_type_id = pc.pokemon_type_id
    INNER JOIN pokemon_stage ps ON ps.pokemon_stage_id = pc.pokemon_stage_id
    INNER JOIN pokemon_set psn ON psn.pokemon_set_id = pc.pokemon_set_id
    INNER JOIN profile_picture pp ON pp.profile_picture_id = u.profile_picture_id
    INNER JOIN rarity r ON r.rarity_id = pc.rarity_id
    WHERE u.user_id = "${uid}"`;

    db.query(query, (err, results) => {

        if (err) throw err;
        const username = results.length > 0 ? results[0].username : '';
        const picUrl = results.length > 0 ? results[0].profile_picture_url : '';
        // res.render('view-collection', { cards: results, logoPath: 'Pokemon_Logo.png' });
        res.render('view-collection', { cards: results, username: username, logoPath: 'Pokemon_Logo.png', picUrl: picUrl });
        console.log(results[0]);
    });

});

// renders home view 
app.get('/home', (req, res) => {
    // const sessionobj = req.session;
    let sess_obj = req.session;
    console.log(sess_obj);
    if (sess_obj.authen) {
        const uid = sess_obj.authen;
        const userQuery = `SELECT u.*, pp.profile_picture_url FROM user u 
                        INNER JOIN profile_picture pp ON pp.profile_picture_id = u.profile_picture_id
                        WHERE u.user_id = "${uid}"`;

        db.query(userQuery, (err, results) => {
            if (err) {
                console.error("Error fetching user data:", err);
                res.status(500).send("Internal Server Error");
                return;
            }

            if (results.length === 0) {
                res.status(404).send("User not found");
                return;
            }

            const userData = results[0];
            const picUrl = userData.profile_picture_url;
            res.render('home', { logoPath: 'Pokemon_Logo.png', userdata: userData, picUrl: picUrl });
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
    const getProfilePicturesQuery = `SELECT profile_picture_id, profile_picture_url FROM profile_picture`;
    db.query(getProfilePicturesQuery, (err, results) => {
        if (err) {
            console.error('Error fetching profile pictures:', err);
            res.status(500).send('Internal Server Error');
            return;
        }
        res.render('sign-up', { logoPath: 'Pokemon_Logo.png', backgroundPath: 'background-2.png', profilePictures: results });

    });
});

// allows users to create an account and inserts them into the database
app.post('/sign-up', (req, res) => {

    const email = req.body.emailField;
    const userName = req.body.usernameField;
    const age = req.body.ageField;
    const password = req.body.passwordField;
    const profilePicID = req.body.profilePicIdField;
    console.log(req.body);
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err);
            res.send('An error occured while creating the account.');
        }

        const query = `INSERT INTO user (username, password, email_address, age, profile_picture_id) VALUES (?, ?,?, ?,?)`;
        console.log(profilePicID);
        db.query(query, [userName, hashedPassword, email, age, profilePicID], (err, result) => {
            if (err) {
                // handle error
                console.error("Error inserting user:", err);
                res.send("An error occured while creating the account.");
                return;
            }
            // Create an empty collection for the new user so that they can add cards
            const userId = result.insertId; // Get the ID of user

            const createCollectionQuery = `INSERT INTO collection (user_id) VALUES (?)`;
            db.query(createCollectionQuery, [userId], (err, result) => {
                if (err) {
                    console.error("Error creating collection:", err);
                    res.send("An error occurred while creating the account.");
                }

                res.redirect('/login'); // later consider redirecting to log in!
            });
        });
    });
});


app.post('/add-to-collection', (req, res) => {
    let sess_obj = req.session;
    const uid = sess_obj.authen;
    const cardID = req.body.card_id;

    const collection_query = `SELECT collection_id FROM collection WHERE user_id = ?`;

    db.query(collection_query, [uid], (err, results) => {
        if (err) {
            console.error('Error retrieving collection ID:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        if (results.length === 0) {
            console.error('No collection found for user');
            res.status(404).send('No collection found for user');
            return;
        }
        const collectionID = results[0].collection_id;

        const insertQuery = `INSERT INTO card_collection (collection_id, card_id) VALUES (?,?)`;

        db.query(insertQuery, [collectionID, cardID], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') { // Handle duplicate entry error
                    res.status(400).send('This card is already in your collection');
                } else {
                    console.error("Error adding to collection:", err);
                    res.status(500).send('Internal Server Error');
                }
            } else {
                res.redirect('/view-cards');
            }
        });

    });
});



app.post('/remove-from-collection', (req, res) => {
    let sess_obj = req.session;
    const userId = sess_obj.authen;
    const cardId = req.body.card_id;
    // Query to get the name of the Pokémon being removed
    const getPokemonNameQuery = `SELECT pokemon_name FROM pokemon_card WHERE pokemon_card_id = ?`;

    const deleteQuery = `DELETE FROM card_collection WHERE collection_id IN (SELECT collection_id FROM collection WHERE user_id = ?) AND card_id = ?`;

    db.query(deleteQuery, [userId, cardId], (err, result) => {
        if (err) {
            console.error("Error removing card from collection:", err);
            res.status(500).send('Internal Server Error');
        } else {
            res.redirect('/view-collection');
        }
    });

});

app.get('/other-collections', (req, res) => {
    let sess_obj = req.session;
    const userId = sess_obj.authen;

    const query = `SELECT u.username, c.collection_id, pp.profile_picture_url,  COUNT(cc.card_id) AS num_cards FROM  user u 
    INNER JOIN  collection c ON u.user_id = c.user_id
    LEFT JOIN  card_collection cc ON c.collection_id = cc.collection_id
    INNER JOIN profile_picture pp ON pp.profile_picture_id = u.profile_picture_id
    GROUP BY 
        c.collection_id`;
    const getUsername = `SELECT * FROM user WHERE user_id = ?`;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching collections:", err);
            res.status(500).send('Internal Server Error');
            return;
        }
        db.query(getUsername, [userId], (err, usernameResult) => {
            if (err) {
                console.error("Error fetching username:", err);
                res.status(500).send('Internal Server Error');
                return;
            }
            if (usernameResult.length === 0) {
                console.error("Username not found for user ID:", userId);
                res.status(404).send('Username not found');
                return;
            }
            const username = usernameResult[0].username;
            console.log(username);
            const picURL = results[0].profile_picture_url;
            res.render('other-collections', { collections: results, logoPath: 'Pokemon_Logo.png', username: username, picUrl: picURL });
        })

    });
});

app.get('/guest-access', (req, res) => {
    res.render('guest-access', { logoPath: 'Pokemon_Logo.png', ballPath: 'Poke_Ball.webp' });
})

app.get('/guest-view-cards', (req, res) => {
    const query = `
    SELECT pc.pokemon_card_id, pc.pokemon_name, pt.pokemon_type_name, pc.url_img, pc.hp, ps.pokemon_stage_name, pc.attack, r.rarity_name, pc.weakness, psn.pokemon_set_name, pc.evolve_from 
    FROM pokemon_card pc 

    INNER JOIN pokemon_type pt ON pt.pokemon_type_id = pc.pokemon_type_id
    INNER JOIN pokemon_stage ps ON ps.pokemon_stage_id = pc.pokemon_stage_id
    INNER JOIN pokemon_set psn ON psn.pokemon_set_id = pc.pokemon_set_id
    INNER JOIN rarity r ON r.rarity_id = pc.rarity_id;`


    db.query(query, (err, results) => {

        if (err) throw err;

        res.render('guest-view-cards', { cards: results, logoPath: 'Pokemon_Logo.png', ballPath: 'Poke_Ball.webp' });
    });

});

// app.get('/filter-by-stage', (req, res) => {
//     const stage_name = req.query.stage_name;
//     const query = `SELECT * FROM pokemon_card pc
//     INNER JOIN pokemon_stage ps ON ps.pokemon_stage_id = pc.pokemon_stage_id
//     WHERE ps.pokemon_stage_name = ?`;

//     db.query(query, [stage_name], (err, filterResults) => {
//         if (err) throw err;
//         if (req.isAuthenticated()){
//             res.render('view-cards', { cards: filterResults, logoPath: 'Pokemon_Logo.png' });
//         } else{
//             res.render('guest-view-cards', { cards: filterResults, logoPath: 'Pokemon_Logo.png' });
//         }

//     });
// });
// Example route accessible to authenticated users only
app.get('/restricted-route', isAuthenticated, (req, res) => {
    res.send('This is a restricted route for authenticated users only.');
});

app.get('/view-card-in-collection', (req, res) => {
    let sess_obj = req.session;
    const userId = sess_obj.authen;
    const collectionId = req.query.collection_id
    const getUsername = `SELECT * FROM user WHERE user_id = ?`

    const query = `
    SELECT pc.pokemon_card_id, pc.pokemon_name, pt.pokemon_type_name, pc.url_img, pc.hp, ps.pokemon_stage_name, pc.attack, r.rarity_name, pc.weakness, psn.pokemon_set_name, pc.evolve_from, c.collection_id
    FROM pokemon_card pc 
    INNER JOIN pokemon_type pt ON pt.pokemon_type_id = pc.pokemon_type_id
    INNER JOIN pokemon_stage ps ON ps.pokemon_stage_id = pc.pokemon_stage_id
    INNER JOIN pokemon_set psn ON psn.pokemon_set_id = pc.pokemon_set_id
    INNER JOIN rarity r ON r.rarity_id = pc.rarity_id 
    INNER JOIN card_collection cc ON cc.card_id = pc.pokemon_card_id
    INNER JOIN collection c ON cc.collection_id = c.collection_id
    INNER JOIN user u ON c.user_id = u.user_id
    WHERE c.collection_id = ?`
    ;

    db.query(query, [collectionId], (err, results) => {
        if (err) {
            console.error("Error fetching cards in collection:", err);
            res.status(500).send('Internal Server Error');
            return;
        }
        db.query(getUsername, [userId], (err, usernameResult) => {
            if (err) {
                console.error("Error fetching username:", err);
                res.status(500).send('Internal Server Error');
                return;
            }
            if (usernameResult.length === 0) {
                console.error("Username not found for user ID:", userId);
                res.status(404).send('Username not found');
                return;
            }
            const username = usernameResult[0].username;
            const picUrl = usernameResult[0].profile_picture_url;
        res.render('view-card-in-collection', { cards: results, logoPath:'Pokemon_Logo.png', username:username, picUrl:picUrl});
    });
});
});
app.listen(3000, () => {
    console.log('Server on port 3000');
});