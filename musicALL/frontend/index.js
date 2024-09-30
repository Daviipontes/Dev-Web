// serverA.js - Servidor A (Frontend)
const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const expressLayouts = require('express-ejs-layouts');
const axios = require('axios'); // Usado para fazer requisições ao servidor B
const multer = require('multer');
const FormData = require('form-data');

const app = express();
const upload = multer();
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

// Middleware para checar se um usuário está logado
function isLoggedIn(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Middleware para verificar se o usuário tem a role necessária
function hasRole(role) {
    return function(req, res, next) {
        if (req.session.user && req.session.user.role === role) {
            next();
        } else {
            res.status(403).send('Acesso negado. Você não tem permissão para realizar esta ação.');
        }
    }
}

// Middleware para verificar múltiplos papéis
function hasAnyRole(roles) {
    return function(req, res, next) {
        if (req.session.user && roles.includes(req.session.user.role)) {
            next();
        } else {
            res.status(403).send('Acesso negado. Você não tem permissão para realizar esta ação.');
        }
    }
}

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
        const serverUrl=API_SERVER_URL;
        console.log(products);
        res.render('pages/index', {
            title: 'Home',
            cssFile: null,
            products,
            serverUrl
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

        const serverUrl=API_SERVER_URL;
        res.render('pages/searchResults', {
            title: `Search Results for "${req.query.query}"`,
            cssFile: null,
            products: filteredProducts,
            serverUrl
        });
    } catch (err) {
        res.status(500).send('Erro ao buscar produtos');
    }
});

app.get('/product/new', isLoggedIn, hasAnyRole(['admin', 'seller']), (req, res) => {
    const user = req.session.user;
    res.render('pages/productForm', { 
        title: 'Adicionar Produto',
        cssFile: 'css/styles/product-page.css', 
        product: {},  // Sem dados para criação
        userRole: user ? user.role : null,
        userEmail: user ? user.email : null
    });
});

app.post('/product/new', upload.fields([{ name: 'images' }, { name: 'video' }]), isLoggedIn, hasAnyRole(['admin', 'seller']), async (req, res) => {
    try {
        const user = req.session.user;
        
        const sessionUserEmail = user ? user.email : null;
        
        const { name, price, brand, rating, availability, categories, description, userEmail} = req.body;
         
        
        
        
        const formData = new FormData();
        formData.append('name', name);
        formData.append('price', price);
        formData.append('brand', brand);
        formData.append('rating', rating);
        formData.append('availability', availability);
        formData.append('categories', categories);
        formData.append('description', description)
        formData.append('userEmail', sessionUserEmail);

        // Adicionar imagens ao FormData
        if (req.files['images']) {
            req.files['images'].forEach((file) => {
                formData.append('images', file.buffer, file.originalname);
            });
        }

        // Adicionar vídeo ao FormData
        if (req.files['video'] && req.files['video'][0]) {
            formData.append('video', req.files['video'][0].buffer, req.files['video'][0].originalname);
        }

        // Adicionar o cookie de sessão no cabeçalho da requisição
        const response = await axios.post(`${API_SERVER_URL}/api/products`, formData, {
            headers: {
                ...formData.getHeaders(),
                Cookie: req.headers.cookie  // Passa o cookie de sessão
            }
        });

        res.redirect('/products');
    } catch (err) {
        console.error('Erro ao adicionar produto:', err.message);
        res.status(500).send('Erro ao adicionar produto');
    }
});


app.post('/product/:id/delete', isLoggedIn, hasAnyRole(['admin', 'seller']), async (req, res) => {
    try {
        const productId = req.params.id;  // Captura o ID do produto da URL

        // Faz uma requisição DELETE para a API de remoção de produtos
        await axios.delete(`${API_SERVER_URL}/api/products/${productId}`, {
            headers: {
                Cookie: req.headers.cookie  // Passa o cookie de sessão
            }
        });

        // Redireciona para a página de produtos após a remoção
        res.redirect('/products');
    } catch (err) {
        console.error('Erro ao remover produto:', err.message);
        res.status(500).send('Erro ao remover produto');
    }
});

app.post('/product/:id/edit', upload.fields([{ name: 'images' }, { name: 'video' }]), isLoggedIn, hasAnyRole(['admin', 'seller']), async (req, res) => {
    try {
        const productId = req.params.id;
        
        
        const user = req.session.user;
        
        const sessionUserEmail = user ? user.email : null;
        
        const { name, price, brand, rating, availability, categories, description, userEmail} = req.body;
        // Criar o formData para enviar os arquivos e dados do produto
        const formData = new FormData();
        formData.append('name', name);
        formData.append('price', price);
        formData.append('brand', brand);
        formData.append('rating', rating);
        formData.append('availability', availability);
        formData.append('categories', categories);
        formData.append('description', description);
        formData.append('userEmail', sessionUserEmail); // Inclui o email do usuário logado

        // Adicionar imagens ao FormData
        if (req.files['images']) {
            req.files['images'].forEach((file) => {
                formData.append('images', file.buffer, file.originalname);
            });
        }

        // Adicionar vídeo ao FormData
        if (req.files['video'] && req.files['video'][0]) {
            formData.append('video', req.files['video'][0].buffer, req.files['video'][0].originalname);
        }

        // Adicionar o cookie de sessão no cabeçalho da requisição
        const response = await axios.put(`${API_SERVER_URL}/api/products/${productId}`, formData, {
            headers: {
                ...formData.getHeaders(),
                Cookie: req.headers.cookie  // Passa o cookie de sessão
            }
        });

        res.redirect('/products');
    } catch (err) {
        console.error('Erro ao editar produto:', err.message);
        res.status(500).send('Erro ao editar produto');
    }
});

// Rota GET para carregar a página de edição de produto
app.get('/product/:id/edit', isLoggedIn, hasAnyRole(['admin', 'seller']), async (req, res) => {
    try {
        const productId = req.params.id;

        // Buscar o produto a partir da API
        const response = await axios.get(`${API_SERVER_URL}/api/products/${productId}`);
        const product = response.data;
        const serverUrl=API_SERVER_URL;
        

        // Renderiza a página de edição, passando os dados do produto para o formulário
        res.render('pages/edit-product', {
            title: 'Editar Produto',
            product: product, // Passa o produto para a página EJS
            userEmail: req.session.user.email, // Email do usuário logado
            serverUrl,
            cssFile: 'css/styles/edit-product.css'  // Arquivo CSS para o estilo
        });
    } catch (err) {
        console.error('Erro ao carregar página de edição:', err);
        res.status(500).send('Erro ao carregar página de edição');
    }
});

// Rota de produto individual
app.get('/product/:id', async (req, res) => {
    const productId = req.params.id;
    const user = req.session.user; 
    
    try {
        
        const response = await axios.get(`${API_SERVER_URL}/api/products/${productId}`);
        const product = response.data;
        const serverUrl=API_SERVER_URL;
        res.render('pages/product', {
            title: 'Produto',
            product,
            serverUrl,
            cssFile: 'css/styles/product-page.css',
            user:user
        });
    } catch (err) {
        res.status(404).send('Produto não encontrado');
    }
});

app.get('/products', isLoggedIn, async (req, res) => {
    try {
        // Faz a requisição para a API para obter todos os produtos
        const response = await axios.get(`${API_SERVER_URL}/api/products`);
        const products = response.data;

        const userRole = req.session.user ? req.session.user.role : null;
        const userEmail = req.session.user ? req.session.user.email : null;

        let filteredProducts = products;
        const serverUrl=API_SERVER_URL;

        // Se o usuário for um seller, filtrar os produtos para mostrar apenas os produtos dele
        if (userRole === 'seller') {
            filteredProducts = products.filter(product => product.seller === userEmail);
        }

        // Renderiza a página com os produtos filtrados
        res.render('pages/products', {
            title: 'Produtos',
            products: filteredProducts,   // Produtos filtrados de acordo com o papel
            userRole: userRole,           // Papel do usuário logado (admin ou seller)
            userEmail: userEmail,  
            serverUrl,     // Email do usuário logado
            cssFile: 'css/styles/product-page.css'
        });
    } catch (err) {
        console.error('Erro ao carregar produtos:', err);
        res.status(500).send('Erro ao carregar produtos');
    }
});

// Rota do carrinho
app.get('/cart', async (req, res) => {
    try {
        const response = await axios.get(`${API_SERVER_URL}/api/cart`);
        const cart = response.data;

        const serverUrl=API_SERVER_URL;
        res.render('pages/cart', {
            title: 'Seu Carrinho',
            cart: cart,
            serverUrl,
            cssFile: 'css/styles/cart.css'
        });
    } catch (err) {
        res.status(500).send('Erro ao carregar carrinho');
    }
});

app.put('/cart', async (req, res) => {
    const { id, quantity } = req.body;

    try {
        const response = await axios.put(`${API_SERVER_URL}/api/cart`, { id, quantity });
        res.json(response.data); // Retorna a resposta do serverApi.js
    } catch (err) {
        console.error('Erro ao atualizar o carrinho:', err.message);
        res.status(500).json({ success: false, message: 'Erro ao atualizar o carrinho.' });
    }
});

// Rota DELETE para remover um item do carrinho
app.delete('/cart/:id', async (req, res) => {
    const productId = req.params.id;

    try {
        const response = await axios.delete(`${API_SERVER_URL}/api/cart/${productId}`);
        res.json(response.data); // Retorna a resposta do serverApi.js
    } catch (err) {
        console.error('Erro ao remover o produto do carrinho:', err.message);
        res.status(500).json({ success: false, message: 'Erro ao remover o produto do carrinho.' });
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
app.get('/checkout', isLoggedIn, async (req, res) => {
    try {
        const cartResponse = await axios.get(`${API_SERVER_URL}/api/cart`);
        const cart = cartResponse.data;
        const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
        const locationResponse = await axios.get(`${API_SERVER_URL}/api/locations`);
        const locationData = locationResponse.data;

        const userEmail = req.session.user.email;
        const userAddressResponse = await axios.get(`${API_SERVER_URL}/api/user-shipping-address`, { params: { email: userEmail } });
        const userShippingAddress = userAddressResponse.data.shippingAddress;

        res.render('pages/checkout', {
            title: 'Checkout',
            cssFile: 'css/styles/checkout.css',
            cart,
            subtotal,
            locationData,
            userShippingAddress
        });
    } catch (err) {
        res.status(500).send('Error loading checkout');
    }
});

// Submeter checkout
app.post('/submit-checkout', upload.single('pix_receipt'), async (req, res) => {
    const { first_name, last_name, company_name, address, country, state, city, zip_code, email, phone_number, pix_name, order_notes } = req.body;
    const userEmail = req.session.user.email;
    try {
        await axios.post(`${API_SERVER_URL}/api/checkout`, {
            userEmail, first_name, last_name, company_name, address, country, state, city, zip_code, email, phone_number, pix_name, order_notes,
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
app.get('/profile', isLoggedIn, async (req, res) => {
    const userEmail = req.session.user ? req.session.user.email : null;

    try {
        const response = await axios.get(`${API_SERVER_URL}/api/profile-details`, { params: { currentUserEmail: userEmail } });
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

// Obter informações do perfil
app.get('/profile/info', isLoggedIn, async (req, res) => {
    try {
        const userEmail = req.session.user.email;

        const response = await axios.get(`${API_SERVER_URL}/api/user-info`, {
            params: { email: userEmail }
        });

        if (response.data.success) {
            res.json({ success: true, user: response.data.user });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (err) {
        console.error('Error fetching user info:', err);
        res.status(500).json({ success: false });
    }
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

// Atualizar detalhes da conta
app.post('/profile/update/account', isLoggedIn, async (req, res) => {
    try {
        const userEmail = req.session.user.email;
        const accountData = req.body;

        const response = await axios.post(`${API_SERVER_URL}/api/update-account`, {
            email: userEmail,
            ...accountData
        });

        res.json({ success: response.data.success });
    } catch (err) {
        console.error('Error updating account:', err);
        res.status(500).json({ success: false });
    }
});

// Atualizar endereço de entrega
app.post('/profile/update/shipping', isLoggedIn, async (req, res) => {
    try {
        const userEmail = req.session.user.email;
        const shippingData = req.body;

        const response = await axios.post(`${API_SERVER_URL}/api/update-shipping`, {
            userEmail: userEmail,
            ...shippingData
        });

        res.json({ success: response.data.success });
    } catch (err) {
        console.error('Error updating shipping address:', err);
        res.status(500).json({ success: false });
    }
});

// Mudar senha
app.post('/profile/update/password', isLoggedIn, async (req, res) => {
    try {
        const userEmail = req.session.user.email;
        const passwordData = req.body;

        const response = await axios.post(`${API_SERVER_URL}/api/change-password`, {
            email: userEmail,
            ...passwordData
        });

        res.json({ success: response.data.success });
    } catch (err) {
        console.error('Error changing password:', err);
        res.status(500).json({ success: false });
    }
});


// Inicialização do servidor
const porta = 8090;
app.listen(porta, () => {
    console.log('Frontend server listening on port ' + porta);
});
