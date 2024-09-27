// serverA.js - Servidor A (Frontend)
const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const expressLayouts = require('express-ejs-layouts');
const axios = require('axios'); // Usado para fazer requisições ao servidor B
const multer = require('multer');

const app = express();
const upload = multer({ dest: 'uploads/' });
const API_SERVER_URL = 'http://localhost:8091'; // URL do Servidor B (API)

// Configuração do middleware de sessão
app.use(session({
    secret: 'chave-secreta',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Middleware para disponibilizar a sessão em todas as views
app.use((req, res, next) => {
    res.locals.user = req.session.user;
    next();
});

// Configuração do EJS e Layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Middleware para servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rota principal (Home) - Buscar produtos do Servidor B
app.get('/', async (req, res) => {
    try {
        const response = await axios.get(`${API_SERVER_URL}/api/products`);
        const products = response.data;
        res.render('pages/index', {
            title: 'Home',
            cssFile: null,
            products
        });
    } catch (err) {
        res.status(500).send('Erro ao carregar produtos');
    }
});

// Rota de busca de produtos
app.get('/search', async (req, res) => {
    const query = req.query.query.toLowerCase();
    try {
        const response = await axios.get(`${API_SERVER_URL}/api/products`);
        const products = response.data;
        const filteredProducts = products.filter(product =>
            product.name.toLowerCase().includes(query)
        );
        res.render('pages/searchResults', {
            title: `Search Results for "${req.query.query}"`,
            cssFile: null,
            products: filteredProducts
        });
    } catch (err) {
        res.status(500).send('Erro ao buscar produtos');
    }
});

// Rota de produto individual
app.get('/product/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        const response = await axios.get(`${API_SERVER_URL}/api/products/${productId}`);
        const product = response.data;
        res.render('pages/product', {
            title: 'Produto',
            product,
            cssFile: 'css/styles/product-page.css'
        });
    } catch (err) {
        res.status(404).send('Produto não encontrado');
    }
});

// Rota do carrinho
app.get('/cart', async (req, res) => {
    try {
        const response = await axios.get(`${API_SERVER_URL}/api/cart`);
        const cart = response.data;
        res.render('pages/cart', {
            title: 'Seu Carrinho',
            cart: cart,
            cssFile: 'css/styles/cart.css'
        });
    } catch (err) {
        res.status(500).send('Erro ao carregar carrinho');
    }
});

// Adicionar produto ao carrinho
app.post('/cart', async (req, res) => {
    const { id, quantity } = req.body;
    try {
        await axios.put(`${API_SERVER_URL}/api/cart`, { id, quantity });
        res.redirect('/cart');
    } catch (err) {
        res.status(404).json({ success: false, message: 'Erro ao adicionar ao carrinho' });
    }
});

// Comprar produto diretamente
app.post('/cart/buy-now', async (req, res) => {
    const { id, quantity } = req.body;
    try {
        await axios.put(`${API_SERVER_URL}/api/cart`, { id, quantity });
        res.redirect('/cart');
    } catch (err) {
        res.status(404).send('Produto não encontrado');
    }
});

// Checkout
app.get('/checkout', async (req, res) => {
    try {
        const response = await axios.get(`${API_SERVER_URL}/api/cart`);
        const cart = response.data;
        const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
        const locationResponse = await axios.get(`${API_SERVER_URL}/api/locations`);
        const locationData = locationResponse.data;
        res.render('pages/checkout', {
            title: 'Checkout',
            cssFile: 'css/styles/checkout.css',
            cart,
            subtotal,
            locationData
        });
    } catch (err) {
        res.status(500).send('Erro ao carregar checkout');
    }
});

// Submeter checkout
app.post('/submit-checkout', upload.single('pix_receipt'), async (req, res) => {
    const { first_name, last_name, company_name, address, country, state, city, zip_code, email, phone_number, pix_name, order_notes } = req.body;
    try {
        await axios.post(`${API_SERVER_URL}/api/checkout`, {
            first_name, last_name, company_name, address, country, state, city, zip_code, email, phone_number, pix_name, order_notes,
            pix_receipt: req.file ? req.file.filename : null
        });
        res.redirect('/finished');
    } catch (err) {
        res.status(500).send('Erro ao submeter o checkout');
    }
});

// Finalização
app.get('/finished', (req, res) => {
    res.render('pages/finished', {
        title: 'Payment Successful',
        cssFile: 'css/styles/finished.css'
    });
});

// Signup
app.get('/signup', (req, res) => {
    res.render('pages/signup', {
        title: 'Sign up',
        cssFile: 'css/styles/login.css'
    });
});

// Submeter signup
app.post('/signup', async (req, res) => {
    const { email, password, confirm_password, name, role } = req.body;

    if (password !== confirm_password) {
        return res.render('pages/signup', {
            title: 'Sign up',
            cssFile: 'css/styles/login.css',
            error: 'Passwords do not match'
        });
    }

    try {
        const response = await axios.post(`${API_SERVER_URL}/api/signup`, { 
            email, 
            password, 
            name, 
            role: role ? 'seller' : 'buyer'
        });

        if (response.data.success) {
            res.redirect('/login');
        } else {
            res.render('pages/signup', {
                title: 'Sign up',
                cssFile: 'css/styles/login.css',
                error: response.data.message
            });
        }
    } catch (err) {
        res.status(500).send('Error during signup');
    }
});

// Login
app.get('/login', (req, res) => {
    res.render('pages/login', {
        title: 'Login',
        cssFile: 'css/styles/login.css'
    });
});

// Submeter login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const response = await axios.post(`${API_SERVER_URL}/api/login`, { email, password });

        if (response.data.success) {
            const user = response.data.user;
            req.session.user = { email: user.email, name: user.name, role: user.role };
            res.redirect('/');
        } else {
            res.render('pages/login', {
                title: 'Login',
                cssFile: 'css/styles/login.css',
                error: response.data.message || 'Invalid email or password'
            });
        }
    } catch (err) {
        res.status(500).send('Error during login');
    }
});

// Rota de logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Error logging out');
        }
        res.redirect('/');
    });
});

// Profile - Obter detalhes do perfil do Servidor B
app.get('/profile', async (req, res) => {
    try {
        const response = await axios.get(`${API_SERVER_URL}/api/profile-details`);
        const profile = response.data;
        res.render('pages/profile', {
            title: 'Profile',
            profile,
            cssFile: 'css/styles/profile.css'
        });
    } catch (err) {
        res.status(500).send('Erro ao carregar perfil');
    }
});

// Configuração do perfil
app.get('/profile_config', (req, res) => {
    res.render('pages/profile_config', {
        title: 'Profile Config',
        cssFile: 'css/styles/profile_config.css'
    });
});

// Obter compras recentes - Chamar a API para buscar compras recentes
app.get('/recent-purchases', async (req, res) => {
    try {
        const response = await axios.get(`${API_SERVER_URL}/api/recent-purchases`);
        const purchases = response.data;
        res.render('pages/recentPurchases', {
            title: 'Recent Purchases',
            purchases,
            cssFile: 'css/styles/purchases.css'
        });
    } catch (err) {
        res.status(500).send('Erro ao carregar compras recentes');
    }
});

// Inicialização do servidor
const porta = 8090;
app.listen(porta, () => {
    console.log('Frontend server listening on port ' + porta);
});
