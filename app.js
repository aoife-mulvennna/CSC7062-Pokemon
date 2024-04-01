const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
const axios = require("axios");
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

app.use(express.static('public'));

app.get('/', (req, res) => {

    res.render('main', { logoPath: 'Pokemon_Logo.png', backgroundPath: 'background-2.png' });

});

app.get('/view-cards', (req, res) => {

    let ep = `http://localhost:4000/pokemon/view-cards`;

    axios.get(ep).then((response) => {
        let bdata = response.data;
        res.render('view-cards', { titletext: 'view pokemon', bdata, logoPath: 'Pokemon_Logo.png' });
    });

});

app.get('/details', (req, res) => {
    let card_id = req.query.card;
    let endp = `http://localhost:4000/pokemon/${card_id}`;

    axios.get(endp).then((response) => {
        res.send(response.data);
    });
});

app.get('/home', (req, res) => {
    res.render('home', { logoPath: 'Pokemon_Logo.png' });
});


app.get('/login', (req, res) => {

    res.render('login', { logoPath: 'Pokemon_Logo.png', backgroundPath: 'background-2.png' });

});


app.get('sign-up', (req, res) => {

    res.render('sign-up', { logoPath: 'Pokemon_Logo.png', backgroundPath: 'background-2.png' });

});



app.get('/populate-one-card/:setId/:localId', (req, res) => {
    let set_id = req.params.setId
    let localId = req.params.localId

    const ep = 'https://api.tcgdex.net/v2/en/sets/' + set_id + '/' + localId

    let cardDataReq = axios.get(ep);
  
    cardDataReq.then((response) => {
        const cardData = response.data
        // console.log(cardData);


        insertData =
            {
                name: cardData.name,
                type: "TODO: Change",
                url_img: cardData.image,
                set_name: cardData.set.name,
                hp: cardData.hp,
                stage: cardData.stage,
                attack: "TODO: Change",
                local_id: cardData.localId,
                rarity: cardData.rarity,
                description: cardData.description,
                weakness: "TODO: Change",
                retreat: cardData.retreat,
                set_id: cardData.set.id,
                illustrator: cardData.illustrator,
                evolve_from: cardData.evolveFrom
            }

        let endpoint = `http://localhost:4000/pokemon/add`;

        const config = {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }

        axios.post(endpoint, insertData, config).then((response) => {
            let insertedid = response.data.respObj.id;
            let resmessage = response.data.respObj.message;
            res.send(`${resmessage}. INSERTED DB id ${insertedid}`);
        }).catch((err) => {
            // console.log(err.message);
        });
    });
});


app.get('/populate-one-card-set/:setId', (req, res) => {
    let set_id = req.params.setId

    let setDataReq = axios.get(`https://api.tcgdex.net/v2/en/sets/` + set_id);

    setDataReq.then((response) => {
        const setData = response.data

        for (let i = 0; i < setData.cards.length; i++) {
            cardData = setData.cards[i];
            const ep = 'http://localhost:3000/populate-one-card/' + set_id + '/' + cardData.localId;
            let cardDataReq = axios.get(ep);

            setDataReq.then((response) => {
                console.log("success")
            });
        }

        res.send(`Set: ${setData.name} - INSERTED ALL CARDS TO DB`);
    });
});


const server = app.listen(PORT, () => {
    console.log(`API started on port ${server.address().port}`);
});