const express = require("express");
const app = express();
const flash = require('connect-flash');

const mysql = require('mysql2');

const bcrypt = require('bcrypt');

app.set('view engine', 'ejs');

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(flash());

const cookieParser = require('cookie-parser');
const sessions = require('express-session');
const moment = require('moment');
// const oneHour = 1000 * 60 * 60 * 1;
const oneDay = 1000 * 60 * 60 * 24; // This will be 24 hours (1 day)


app.use(cookieParser());

app.use(sessions({
    secret: "mypokemon12",
    saveUninitialized: true,
    cookie: { maxAge: oneDay },
    resave: false
}));


const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'pokemon',
    port: '8889'
});

const getUserIdFromSession = (req, res, next) => {
    let sess_obj = req.session;
    req.userId = sess_obj.authen; // Assuming the user ID is stored in sess_obj.authen
    next(); // Call next to proceed to the next middleware or route handler
};

//random card of the day function
function selectRandomCard(callback) {
    const query = 'SELECT * FROM pokemon_card ORDER BY RAND() LIMIT 1';
    db.query(query, (err, result) => {
        if (err) {
            callback(err, null);
            return;
        }
        const randomCard = result[0];
        callback(null, randomCard);
    });
}

function insertCardOfTheDay(card_id, callback) {
    const validDate = moment().format('YYYY-MM-DD');
    const query = 'INSERT INTO card_of_day (card_id, valid_date) VALUES (?, ?)';
    db.query(query, [card_id, validDate], (err, result) => {
        if (err) {
            callback(err);
            return;
        }
        callback(null);
    });
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
            res.render('view-cards', { cards: cardsResults, sess_obj, userdata: userData, currentPage: req.path });
        });
    });
});

app.get('/view-collection', (req, res) => {
    let sess_obj = req.session;
    const uid = sess_obj.authen;

    const query = ` SELECT  pc.*, ps.pokemon_stage_name, psn.pokemon_set_name, pt.pokemon_type_name, pp.*, r.rarity_name, c.collection_name
    FROM user u
    INNER JOIN collection c ON u.user_id = c.user_id
    INNER JOIN card_collection cc ON c.collection_id = cc.collection_id
    INNER JOIN pokemon_card pc ON cc.card_id = pc.pokemon_card_id 
    INNER JOIN pokemon_type pt ON pt.pokemon_type_id = pc.pokemon_type_id
    INNER JOIN pokemon_stage ps ON ps.pokemon_stage_id = pc.pokemon_stage_id
    INNER JOIN pokemon_set psn ON psn.pokemon_set_id = pc.pokemon_set_id
    INNER JOIN profile_picture pp ON pp.profile_picture_id = u.profile_picture_id
    INNER JOIN rarity r ON r.rarity_id = pc.rarity_id
    WHERE u.user_id = ?`;

    db.query(query, [uid], (err, results) => {

        if (err) {
            console.error("Error getting collection data:", err);
            res.status(500).send("Internal Server Error");
            return;
        }
        const getUserQuery = `SELECT u.username, pp.profile_picture_url FROM 
        user u INNER JOIN profile_picture pp ON pp.profile_picture_id = u.profile_picture_id 
        WHERE u.user_id = ?`

        db.query(getUserQuery, [uid], (err, userResults) => {
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
            const collectionName = results[0].collection_name;
            username = userData.username;
            const picUrl = userData.profile_picture_url;
            res.render('view-collection', { cards: results, username: username, logoPath: 'Pokemon_Logo.png', picUrl: picUrl, sess_obj, userdata: userData, currentPage: req.path, collectionName });
        });

    });
});


// renders home view 
app.get('/home', (req, res) => {
    let sess_obj = req.session;
    console.log(sess_obj);
    if (sess_obj.authen) {
        const uid = sess_obj.authen;
        const userQuery = `SELECT u.*, pp.profile_picture_url FROM user u 
                        INNER JOIN profile_picture pp ON pp.profile_picture_id = u.profile_picture_id
                        WHERE u.user_id = ?`;
        db.query(userQuery, [uid], (err, results) => {
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
            // Check if a card of the day exists for the current date
            const today = moment().format('YYYY-MM-DD');
            const checkCardQuery = `SELECT pc.* FROM card_of_day cd 
            INNER JOIN pokemon_card pc ON cd.card_id = pc.pokemon_card_id
            WHERE cd.valid_date = ?`;
            db.query(checkCardQuery, [today], (err, cardResult) => {
                if (err) {
                    console.error("Error checking card of the day:", err);
                    res.status(500).send("Internal Server Error");
                    return;
                }
                if (cardResult.length === 0) {
                    // If no card of the day exists for today, select a random card and insert it into the database
                    selectRandomCard((err, randomCard) => {
                        if (err) {
                            console.error("Error selecting random card:", err);
                            res.status(500).send("Internal Server Error");
                            return;
                        }

                        insertCardOfTheDay(randomCard.pokemon_card_id, (err) => {
                            if (err) {
                                console.error("Error inserting card of the day:", err);
                                res.status(500).send("Internal Server Error");
                                return;
                            }

                            // Render the home page with the selected card of the day
                            res.render('home', { logoPath: 'Pokemon_Logo.png', userdata: userData, sess_obj, cardOfTheDay: randomCard, currentPage: req.path });
                        });
                    });
                } else {
                    // if card of day exists for today, display it
                    const cardOfTheDay = cardResult[0];
                    res.render('home', { logoPath: 'Pokemon_Logo.png', userdata: userData, sess_obj, cardOfTheDay: cardOfTheDay, currentPage: req.path });
                }
            });
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

    const userDataQuery = `SELECT * FROM user WHERE username = ?`;

    db.query(userDataQuery, [usernameField], (err, results) => {
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

app.get('/logout', (req, res) => {
    // Destroys session
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            res.status(500).send('Internal Server Error');
            return;
        }
        // Redirect the user to the main external page
        console.log('user successfully logged out');
        res.redirect('/');
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

            const userId = result.insertId;


            const createWishlistQuery = `INSERT INTO wishlist (user_id) VALUES (?)`;
            db.query(createWishlistQuery, [userId], (err, result) => {
                if (err) {
                    console.error("Error creating wishlist:", err);
                    res.send("An error occurred while creating the account.");
                }

                res.redirect('/login'); // later consider redirecting to log in!
            });
        });
    });
});

app.post('/update-password', (req, res) => {
    let sess_obj = req.session;
    const uid = sess_obj.authen;
    console.log('user id=', uid);

    const { currentPasswordField, newPasswordField } = req.body;

    const userDataQuery = `SELECT * FROM user WHERE user_id = ?`;

    db.query(userDataQuery, [uid], (err, results) => {
        if (err) {
            console.error('Error querying database: ', err);
            res.status(500).send('Internal Sever Error');
            return;
        }
        if (results.length === 0) {
            res.status(401).send('There are no accounts found with user id' + uid);
            return;
        }
        const hashedPassword = results[0].password;

        bcrypt.compare(currentPasswordField, hashedPassword, (bcryptErr, isMatch) => {
            if (bcryptErr) {
                console.error('Error comparing passwords:', bcryptErr);
                res.status(500).send('Internal Sever Error');
                return;
            }
            // if the passwords match, allow user to update their password!
            if (isMatch) {
                // hash the password 
                bcrypt.hash(newPasswordField, 10, (err, hashedNewPassword) => {
                    if (err) {
                        console.error('Error hashing password:', err);
                        res.send('An error occured while updating the password.');
                    }
                    const updatePassQuery = `UPDATE user SET password = ? WHERE user_id = ?`;
                    db.query(updatePassQuery, [hashedNewPassword, uid], (err, result) => {
                        if (err) {
                            console.error("Error updating password:", err);
                            return res.status(500).send("An error occurred while updating the password");

                            // res.send("An error occured while updating the password");
                            // return;
                        }
                        res.send('Your password has been updated successfully');
                        console.log('password updated successfully');
                    });
                })
            } else {
                res.status(401).send('Current password is incorrect');
            }
        });
    });
});

app.post('/update-profile-picture', (req, res) => {
    const { uid, profilePicUrl } = req.body;

    const updateProfilePictureQuery = `UPDATE user SET profile_picture_id = (SELECT profile_picture_id FROM profile_picture WHERE profile_picture_url = ?) WHERE user_id = ?`;
    db.query(updateProfilePictureQuery, [profilePicUrl, uid], (err, result) => {
        if (err) {
            console.error("Error updating profile picture:", err);
            res.status(500).send('Internal Server Error');
            return;
        }
        res.sendStatus(200); // Send success status
    });
});


app.get('/other-collections', (req, res) => {
    let sess_obj = req.session;
    console.log(sess_obj)
    const userId = sess_obj.authen;
    const query = `SELECT u.*, c.collection_id, c.collection_name, pp.profile_picture_url,  COUNT(cc.card_id) AS num_cards, ROUND(AVG(r.rating_value),1) AS average_rating FROM  user u 
    INNER JOIN  collection c ON u.user_id = c.user_id
    LEFT JOIN  card_collection cc ON c.collection_id = cc.collection_id
    INNER JOIN profile_picture pp ON pp.profile_picture_id = u.profile_picture_id
    LEFT JOIN rating r ON r.collection_id = c.collection_id
    GROUP BY 
        c.collection_id`;
    const getUsername = `SELECT user.username, pp.profile_picture_url FROM user INNER JOIN profile_picture pp ON pp.profile_picture_id = user.profile_picture_id WHERE user_id = ?`;

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
            const userData = usernameResult[0];
            const username = usernameResult[0].username;
            const picURL = results[0].profile_picture_url;
            res.render('other-collections', { collections: results, logoPath: 'Pokemon_Logo.png', username: username, picUrl: picURL, sess_obj, userdata: userData, currentPage: req.path });
        })
    });
});

app.get('/guest-access', (req, res) => {
    let sess_obj = req.session;
    sess_obj.authen = false;
    res.render('guest-access', { logoPath: 'Pokemon_Logo.png', ballPath: 'Poke_Ball.webp', sess_obj: false, currentPage: req.path });
});

app.get('/view-card-in-collection', (req, res) => {
    let sess_obj = req.session;
    const userId = sess_obj.authen;
    const collectionId = req.query.collection_id
    // get information about the user for the nav bar (profile picture and username)
    const getUserQuery = `SELECT * FROM user u INNER JOIN profile_picture pp ON pp.profile_picture_id = u.profile_picture_id WHERE user_id = ?`
    db.query(getUserQuery, [userId], (err, usernameResult) => {
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
        // need to get the logged in users rating of that collection 
        const getRatingQuery = `SELECT rating_value FROM rating WHERE rating_user_id = ? AND collection_id = ?`;
        console.log('collection id:', collectionId);
        db.query(getRatingQuery, [userId, collectionId], (err, ratingResult) => {
            if (err) {
                console.error("Error fetching user's rating:", err);
                res.status(500).send('Internal Server Error');
                return;
            }
            const userData = usernameResult[0];
            const userRating = ratingResult.length > 0 ? ratingResult[0].rating_value : null;
            const username = usernameResult[0].username;
            const picUrl = usernameResult[0].profile_picture_url;
            // check if the logged in user owns the collection
            const checkOwnershipQuery = `SELECT u.user_id, pp.profile_picture_url, u.username, c.collection_name FROM collection c INNER JOIN user u ON u.user_id = c.user_id INNER JOIN profile_picture pp ON pp.profile_picture_id = u.profile_picture_id WHERE collection_id = ?`;
            db.query(checkOwnershipQuery, [collectionId], (err, ownershipResult) => {
                if (err) {
                    console.error("Error checking ownership:", err);
                    res.status(500).send('Internal Server Error');
                    return;
                }
                // gets value to see if they are the owner. this info is passed on to the view-card-in-collection page to vary the buttons that are shown on that page. 
                const isOwner = ownershipResult.length > 0 && ownershipResult[0].user_id === userId;
                // gets the id of the owner of the collection
                // check if there are cards in the collection. 
                const checkCardsQuery = `SELECT * FROM card_collection WHERE collection_id = ?`;
                db.query(checkCardsQuery, [collectionId], (err, cardCollectionResults) => {
                    if (err) {
                        console.error("Error checking cards in collection:", err);
                        res.status(500).send('Internal Server Error');
                        return;
                    }
                    // if there are no cards in the collection, logs that the collection is empty. 
                    if (cardCollectionResults.length === 0) {
                        console.log("Collection is empty");
                        res.render('view-card-in-collection', {
                            logoPath: 'Pokemon_Logo.png',
                            username: username, ownerPic: ownershipResult[0].profile_picture_url, ownerUsername: ownershipResult[0].username,
                            isOwner, collectionId: collectionId, userRating: userRating, sess_obj, userdata: userData, currentPage: req.path
                            , cardCollectionResults, collectionName: ownershipResult[0].collection_name
                        });
                    } else {
                        const query = `
                    SELECT pc.pokemon_card_id, pc.pokemon_name, pt.pokemon_type_name, pc.url_img, pc.hp, ps.pokemon_stage_name, 
                    pc.attack, r.rarity_name, pc.weakness, psn.pokemon_set_name, pc.evolve_from, 
                    c.collection_id, pp.profile_picture_id,pp.profile_picture_url, u.username
                    FROM pokemon_card pc 
                    INNER JOIN pokemon_type pt ON pt.pokemon_type_id = pc.pokemon_type_id
                    INNER JOIN pokemon_stage ps ON ps.pokemon_stage_id = pc.pokemon_stage_id
                    INNER JOIN pokemon_set psn ON psn.pokemon_set_id = pc.pokemon_set_id
                    INNER JOIN rarity r ON r.rarity_id = pc.rarity_id 
                    INNER JOIN card_collection cc ON cc.card_id = pc.pokemon_card_id
                    INNER JOIN collection c ON cc.collection_id = c.collection_id
                    INNER JOIN user u ON c.user_id = u.user_id
                    INNER JOIN profile_picture pp ON pp.profile_picture_id = u.profile_picture_id
                    WHERE c.collection_id = ?`;
                        db.query(query, [collectionId], (err, collectionResults) => {
                            if (err) {
                                console.error("Error fetching cards in collection:", err);
                                res.status(500).send('Internal Server Error');
                                return;
                            }
                            res.render('view-card-in-collection', {
                                cards: collectionResults, logoPath: 'Pokemon_Logo.png',
                                username: username, picUrl: picUrl, ownerPic: ownershipResult[0].profile_picture_url, ownerUsername: ownershipResult[0].username, collectionId: collectionId, userRating: userRating, sess_obj, userdata: userData, currentPage: req.path
                                , cardCollectionResults, isOwner: isOwner, collectionName: ownershipResult[0].collection_name
                            });
                        });

                    }
                });
            });
        });
    });
});


app.post('/add-to-collection', getUserIdFromSession, (req, res) => {
    // let sess_obj = req.session;
    // const uid = sess_obj.authen;
    const uid = req.userId;
    const cardID = req.body.card_id;
    const collectionID = req.body.collection_id;
    console.log('collection id', collectionID);
    const insertQuery = `INSERT INTO card_collection (collection_id, card_id) VALUES (?,?)`;

    db.query(insertQuery, [collectionID, cardID], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') { // Handle duplicate entry error
                // res.status(400).send('This card is already in your collection');
                res.status(400).json({ message: 'This card is already in your collection' });
            } else {
                console.error("Error adding to collection:", err);
                res.status(500).send('Internal Server Error');
            }
        } else {
            console.log("successfully added to collection");
            // res.status(200).json({ message: 'Card added to your collection successfully', redirectUrl: '/view-cards' });
            res.redirect(req.get('referer'));
        }
    });

});

app.post('/remove-from-collection', (req, res) => {
    let sess_obj = req.session;
    const userId = sess_obj.authen;
    const cardId = req.body.card_id;
    const collectionName = req.body.collection_name;
    const collectionId = req.body.collection_id;
    console.log('name of collection:', collectionName);
    console.log('collectionId:', collectionId);
    if (!userId || !collectionId) {
        console.error("User ID or Collection ID is undefined");
        res.status(400).send('Bad Request');
        return;
    }
    const deleteQuery = `DELETE FROM card_collection WHERE collection_id = ? AND card_id = ?`;
    db.query(deleteQuery, [collectionId, cardId], (err, result) => {
        if (err) {
            console.error("Error removing card from collection:", err);
            res.status(500).send('Internal Server Error');
        } else {
            console.log(sess_obj)
            console.log('card removed from collection successfully');
            res.redirect(req.get('referer'));
        }
    });
});


// endpoint for leaving a rating 
app.post('/ratings', getUserIdFromSession, (req, res) => {
    const ratingUserId = req.userId;
    const collectionId = req.body.collectionId;
    const ratingValue = req.body.ratingValue;
    // checking if the user has already rated the collection
    const checkRatingQuery = `SELECT * FROM rating WHERE collection_id = ? AND rating_user_id = ?`;
    db.query(checkRatingQuery, [collectionId, ratingUserId], (err, result) => {
        if (err) {
            console.error("Error checking existing rating:", err);
            res.status(500).send('Internal Server Error');
            return;
        }
        if (result.length > 0) {
            const updateRatingQuery = `UPDATE rating SET rating_value = ? WHERE collection_id = ? AND rating_user_id = ?`;
            db.query(updateRatingQuery, [ratingValue, collectionId, ratingUserId], (err, updateResult) => {
                if (err) {
                    console.error("Error updating rating:", err);
                    res.status(500).send('Internal Server Error');
                    return;
                }
                res.redirect('/view-card-in-collection?collection_id=' + collectionId);
            });
        } else {
            // insert rating
            const insertRatingQuery = `INSERT INTO rating (rating_user_id, collection_id, rating_value) VALUES (?, ?, ?)`;
            db.query(insertRatingQuery, [ratingUserId, collectionId, ratingValue], (err, result) => {
                if (err) {
                    console.error("Error submitting rating:", err);
                    res.status(500).send('Internal Server Error');
                    return;
                }
                console.log("Rating submitted successfully");
                res.redirect(req.get('referer'));
            });
        }
    });
});

// get the ratings from database to display 
app.get('/ratings/:collectionId', (req, res) => {
    const collectionId = req.params.collectionId;
    const query = `SELECT * FROM rating WHERE collection_id = ?`;
    db.query(query, [collectionId], (err, result) => {
        if (err) {
            console.error("Error retrieving ratings:", err);
            res.status(500).send('Internal Server Error');
            return;
        }
        res.json(result); // Send the retrieved ratings back as JSON
    });
});

app.get('/view-account', (req, res) => {

    let sess_obj = req.session;
    const uid = sess_obj.authen;
    console.log('user id=', uid);
    const getAccountQuery = `SELECT u.*, pp.profile_picture_url FROM user u INNER JOIN profile_picture pp ON pp.profile_picture_id = u.profile_picture_id WHERE user_id = ?`;

    db.query(getAccountQuery, [uid], (err, accountDetails) => {
        if (err) {
            console.error("Error finding account details", err);
            res.status(500).send('Internal Server Error');
            return;
        }
        const userData = accountDetails[0];

        // query for profile pictures
        const getProfilePicturesQuery = `SELECT profile_picture_id, profile_picture_url FROM profile_picture`;
        db.query(getProfilePicturesQuery, (err, profilePictures) => {
            if (err) {
                console.error('Error fetching profile pictures:', err);
                res.status(500).send('Internal Server Error');
                return;
            }

            res.render('view-account', { details: accountDetails, logoPath: 'Pokemon_Logo.png', profilePictures: profilePictures, sess_obj, userdata: userData, currentPage: req.path })
        });
    });
});


app.post('/delete-account', (req, res) => {
    let sess_obj = req.session;
    const uid = sess_obj.authen;

    const deleteCardCollectionQuery = `DELETE FROM card_collection WHERE collection_id = (SELECT collection_id FROM collection WHERE user_id = ?)`;
    // const collectionId = `SELECT collection_id FROM collection WHERE user_id = "${uid}"`;
    db.query(deleteCardCollectionQuery, [uid], (err, result) => {
        // if (err) throw err;

        const deleteCollectionQuery = `DELETE FROM collection WHERE user_id = ?`;
        db.query(deleteCollectionQuery, [uid], (err, result) => {

            // if (err) throw err;
            const deleteRatingQuery = `DELETE FROM rating WHERE rating_user_id = ?`;

            db.query(deleteRatingQuery, [uid], (err, result) => {

                // if (err) throw err;

                const deleteAccountQuery = 'DELETE FROM user WHERE user_id = ?';
                db.query(deleteAccountQuery, [uid], (err, result) => {
                    if (err) {
                        console.error("Error deleting account", err);
                        res.status(500).send('Internal Server Error');
                    } else {
                        res.send('Account deleted successfully');
                    }

                });

            })
        })
    })
});

app.get('/guest-view-cards/sort', (req, res) => {

    const sort = req.query.sort;
    const order = req.query.value === 'asc' ? 'ASC' : 'DESC';

    let sortQuery = ` SELECT pc.pokemon_card_id, pc.pokemon_name, pt.pokemon_type_name, pc.url_img, pc.hp, ps.pokemon_stage_name, pc.attack, r.rarity_name, pc.weakness, psn.pokemon_set_name, pc.evolve_from 
    FROM pokemon_card pc 
    INNER JOIN pokemon_type pt ON pt.pokemon_type_id = pc.pokemon_type_id
    INNER JOIN pokemon_stage ps ON ps.pokemon_stage_id = pc.pokemon_stage_id
    INNER JOIN pokemon_set psn ON psn.pokemon_set_id = pc.pokemon_set_id
    INNER JOIN rarity r ON r.rarity_id = pc.rarity_id ORDER BY ${sort} ${order}`;

    db.query(sortQuery, (err, result) => {
        // if (err) throw err;

        const stageQuery = `SELECT * FROM pokemon_stage`;
        db.query(stageQuery, (err, stageResults) => {
            // if (err) throw err;

            const rarityQuery = `SELECT * FROM rarity`;
            db.query(rarityQuery, (err, rarityResults) => {
                // if (err) throw err;
                const typeQuery = `SELECT * FROM pokemon_type`;
                db.query(typeQuery, (err, typeResults) => {
                    // if (err) throw err;
                    const setQuery = `SELECT * FROM pokemon_set`;
                    db.query(setQuery, (err, setResults) => {
                        // if (err) throw err;
                        res.render('guest-view-cards', { cards: result, sess_obj: false, currentPage: req.path, stageResults, rarityResults, typeResults, setResults });
                    });
                })
            })
        })
    });
});

app.get('/guest-view-cards', (req, res) => {
    let sess_obj = req.session;
    const selectedRarities = req.query.rarity;
    console.log('Selected rarities:', selectedRarities);
    const selectedStages = req.query.stage;
    console.log('Selected stages:', selectedStages);
    const selectedSets = req.query.set;
    console.log('Selected sets:', selectedSets);
    const selectedTypes = req.query.type;
    console.log('Selected types:', selectedTypes);
    let query = `
    SELECT pc.pokemon_card_id, pc.pokemon_name, pt.pokemon_type_name, pc.url_img, pc.hp, 
           ps.pokemon_stage_name, r.rarity_name, w.weakness_type, w.weakness_strength, 
           psn.pokemon_set_name, pc.evolve_from, pc.illustrators, pc.attack_name, pc.attack_description, pc.attack_damage 
    FROM pokemon_card pc 
    INNER JOIN pokemon_type pt ON pt.pokemon_type_id = pc.pokemon_type_id
    INNER JOIN pokemon_stage ps ON ps.pokemon_stage_id = pc.pokemon_stage_id
    INNER JOIN pokemon_set psn ON psn.pokemon_set_id = pc.pokemon_set_id
    INNER JOIN rarity r ON r.rarity_id = pc.rarity_id
   INNER JOIN weakness w ON w.card_id = pc.pokemon_card_id`;

    
    if (selectedRarities && selectedRarities.length > 0) {
        if (!Array.isArray(selectedRarities)) {
            query += ` AND r.rarity_name = '${selectedRarities}'`;
        } else {
            query += ` AND r.rarity_name IN ('${selectedRarities.join("','")}')`;
        }
    }
    if (selectedStages && selectedStages.length > 0) {
        if (!Array.isArray(selectedStages)) {
            query += ` AND ps.pokemon_stage_name = '${selectedStages}'`;
        } else {
            query += ` AND ps.pokemon_stage_name IN ('${selectedStages.join("','")}')`;
        }
    }
    if (selectedSets && selectedSets.length > 0) {
        if (!Array.isArray(selectedSets)) {
            query += ` AND psn.pokemon_set_name = '${selectedSets}'`;
        } else {
            query += ` AND psn.pokemon_set_name IN ('${selectedSets.join("','")}')`;
        }
    }
    if (selectedTypes && selectedTypes.length > 0) {
        if (!Array.isArray(selectedTypes)) {
            query += ` AND pt.pokemon_type_name = '${selectedTypes}'`;
        } else {
            query += ` AND pt.pokemon_type_name IN ('${selectedTypes.join("','")}')`;
        }
    }
    console.log('Generated SQL Query:', query);
    db.query(query, (err, results) => {
        // if (err) throw err;
        const stageQuery = `SELECT * FROM pokemon_stage`;
        db.query(stageQuery, (err, stageResults) => {
            // if (err) throw err;

            const rarityQuery = `SELECT * FROM rarity`;
            db.query(rarityQuery, (err, rarityResults) => {
                // if (err) throw err;
                const typeQuery = `SELECT * FROM pokemon_type`;
                db.query(typeQuery, (err, typeResults) => {
                    // if (err) throw err;
                    const setQuery = `SELECT * FROM pokemon_set`;
                    db.query(setQuery, (err, setResults) => {
                        let numberResults = results.length;
                        // if (err) throw err;
                        if (!sess_obj.authen) {
                            console.log('results: ', results)
                            res.render('guest-view-cards', { cards: results, sess_obj: false, currentPage: req.path, stageResults, rarityResults, typeResults, setResults, numberResults });
                        } else {
                            const uid = sess_obj.authen;
                            const getUserQuery = `SELECT u.username, pp.profile_picture_url FROM 
        user u INNER JOIN profile_picture pp ON pp.profile_picture_id = u.profile_picture_id 
        WHERE u.user_id = ?`;
                            db.query(getUserQuery, [uid], (err, userResults) => {
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
                           
                                const collectionNameQuery = `SELECT collection.collection_id, collection.collection_name FROM collection WHERE user_id = ?`;
                                db.query(collectionNameQuery, [uid], (err, collectionNameResults) => {
                                    // if (err) throw err;
                                    
                                    res.render('guest-view-cards', { cards: results, sess_obj: true, userdata: userData, currentPage: req.path, stageResults, rarityResults, typeResults, setResults, collectionNameResults, numberResults });
                                });
                            });
                        }
                    })
                })
            })
        })
    });
});

app.get('/create-collection', (req, res) => {
    let sess_obj = req.session;
    const uid = sess_obj.authen;
    const getUserData = `SELECT user.username, pp.profile_picture_url FROM user INNER JOIN profile_picture pp ON user.profile_picture_id = pp.profile_picture_id WHERE user_id = ?`;
    db.query(getUserData, [uid], (err, userResults) => {
        res.render('create-collection', { sess_obj: true, currentPage: req.path, userdata: userResults });
    })

});

app.post('/create-collection', (req, res) => {
    let sess_obj = req.session;
    let uid = sess_obj.authen;
    let collectionName = req.body.collectionNameField;

    db.query('INSERT INTO collection (collection_name, user_id) VALUES (?, ?)', [collectionName, uid], (err, result) => {
        if (err) {
            // Handle error
            console.error(err);
            res.status(500).send('An error occurred while creating the collection.');
        } else {
            // Collection successfully created
            // res.redirect('/view-my-collections'); 
            console.log('new collection created successfully');
            res.redirect(req.get('referer'));
        }
    });
});

app.get('/view-wishlist', (req, res) => {
    let sess_obj = req.session;
    const uid = sess_obj.authen;

    const query = ` SELECT  pc.*, ps.pokemon_stage_name, psn.pokemon_set_name, pt.pokemon_type_name, pp.*, r.rarity_name, w.*
    FROM user u
    INNER JOIN wishlist w ON u.user_id = w.user_id
    INNER JOIN card_wishlist cw ON cw.wishlist_id = w.wishlist_id
    INNER JOIN pokemon_card pc ON cw.pokemon_card_id = pc.pokemon_card_id 
    INNER JOIN pokemon_type pt ON pt.pokemon_type_id = pc.pokemon_type_id
    INNER JOIN pokemon_stage ps ON ps.pokemon_stage_id = pc.pokemon_stage_id
    INNER JOIN pokemon_set psn ON psn.pokemon_set_id = pc.pokemon_set_id
    INNER JOIN profile_picture pp ON pp.profile_picture_id = u.profile_picture_id
    INNER JOIN rarity r ON r.rarity_id = pc.rarity_id
    WHERE u.user_id = ?`;

    db.query(query, [uid], (err, results) => {

        if (err) {
            console.error("Error getting wishlist data:", err);
            res.status(500).send("Internal Server Error");
            return;
        }
        const getUserQuery = `SELECT u.username, pp.profile_picture_url FROM 
        user u INNER JOIN profile_picture pp ON pp.profile_picture_id = u.profile_picture_id 
        WHERE u.user_id = ?`

        db.query(getUserQuery, [uid], (err, userResults) => {
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
            res.render('view-wishlist', { cards: results, username: username, logoPath: 'Pokemon_Logo.png', picUrl: picUrl, sess_obj: true, userdata: userData, currentPage: req.path });
        });

    });
});

app.post('/add-to-wishlist', getUserIdFromSession, (req, res) => {
    const uid = req.userId;
    const cardID = req.body.card_id;

    const wishlist_query = `SELECT wishlist_id FROM wishlist WHERE user_id = ?`;
    db.query(wishlist_query, [uid], (err, results) => {
        if (err) {
            console.error('Error retrieving wishlist ID:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        if (results.length === 0) {
            console.error('No wishlist found for user');
            res.status(404).send('No wishlist found for user');
            return;
        }
        const wishlistID = results[0].wishlist_id;

        const insertQuery = `INSERT INTO card_wishlist (wishlist_id, pokemon_card_id) VALUES (?,?)`;

        db.query(insertQuery, [wishlistID, cardID], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') { // Handle duplicate entry error
                    // res.status(400).send('This card is already in your collection');
                    res.status(400).json({ message: 'This card is already in your wishlist' });
                } else {
                    console.error("Error adding to wishlist:", err);
                    res.status(500).send('Internal Server Error');
                }
            } else {
                console.log("successfully added to wishlist");
               res.redirect(req.get('referer'));
               
            }
        });

    });
});

app.post('/remove-from-wishlist', (req, res) => {
    let sess_obj = req.session;
    const userId = sess_obj.authen;
    const cardId = req.body.card_id;
    // Query to get the name of the Pokémon being removed
    const getPokemonNameQuery = `SELECT pokemon_name FROM pokemon_card WHERE pokemon_card_id = ?`;

    const deleteQuery = `DELETE FROM card_wishlist WHERE wishlist_id IN (SELECT wishlist_id FROM wishlist WHERE user_id = ?) AND pokemon_card_id = ?`;

    db.query(deleteQuery, [userId, cardId], (err, result) => {
        if (err) {
            console.error("Error removing card from wishlist:", err);
            res.status(500).send('Internal Server Error');
        } else {
            console.log('successfully removed from wishlist');
            res.redirect(req.get('referer'));
        }
    });
});

app.post('/delete-collection', (req, res) => {
    const collectionId = req.body.collectionId;

    // Query to delete associated items from the 'card_collection' table
    const deleteCardCollectionQuery = `DELETE FROM card_collection WHERE collection_id = ?`;


    // Query to delete collection from the 'collection' table
    const deleteCollectionQuery = `DELETE FROM collection WHERE collection_id = ?`;

    db.query(deleteCardCollectionQuery, [collectionId], (err, cardCollectionDeleteResult) => {
        if (err) {
            console.error("Error deleting card collection items:", err);
            res.status(500).send('Internal Server Error');
            return;
        }
        db.query(deleteCollectionQuery, [collectionId], (err, collectionDeleteResult) => {
            if (err) {
                console.error("Error deleting collection:", err);
                res.status(500).send('Internal Server Error');
                return;
            }

            console.log('collection deleted successfully');
            res.redirect(req.get('referer'));
        });
    });
});


app.get('/view-my-collections', (req, res) => {
    let sess_obj = req.session;
    const userId = sess_obj.authen;
    const viewCollectionsQuery = `SELECT u.username, c.collection_id, c.collection_name, pp.profile_picture_url,  COUNT(cc.card_id) AS num_cards, ROUND(AVG(r.rating_value),1) AS average_rating FROM  user u 
    INNER JOIN  collection c ON u.user_id = c.user_id
    LEFT JOIN  card_collection cc ON c.collection_id = cc.collection_id
    INNER JOIN profile_picture pp ON pp.profile_picture_id = u.profile_picture_id
    LEFT JOIN rating r ON r.collection_id = c.collection_id
    WHERE u.user_id = ?
    GROUP BY 
        c.collection_id ` ;
    const getUserQuery = `SELECT * FROM user WHERE user_id = ?`;
    db.query(viewCollectionsQuery, [userId], (err, results) => {
        if (err) {
            console.error("Error fetching your collections:", err);
            res.status(500).send('Internal Server Error');
            return;
        }
        db.query(getUserQuery, [userId], (err, usernameResult) => {
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
            const userData = usernameResult[0];
            const username = usernameResult[0].username;
            const picURL = results[0].profile_picture_url;
            res.render('view-my-collections', { collections: results, logoPath: 'Pokemon_Logo.png', username: username, picUrl: picURL, sess_obj, userdata: userData, currentPage: req.path });
        })

    });
});

app.listen(3000, () => {
    console.log('Server on port 3000');
});