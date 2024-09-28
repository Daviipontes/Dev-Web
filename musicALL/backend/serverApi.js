// serverB.js - Servidor B (API)
const express = require('express');
const path = require('path');
const fs = require('fs').promises;   
const bodyParser = require('body-parser');
const app = express();

const cors = require('cors');
app.use(cors());
const multer = require('multer');
// Configuração do destino de upload para imagens e vídeos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, path.join(__dirname, 'public/uploads/images')); // Salvar imagens
        } else if (file.mimetype.startsWith('video/')) {
            cb(null, path.join(__dirname, 'public/uploads/videos')); // Salvar vídeos
        } else {
            cb({ message: 'Arquivo inválido, apenas imagens e vídeos são permitidos.' }, false);
        }
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

// Limitar o tamanho do upload e os tipos de arquivos
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50 MB
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas imagens e vídeos são permitidos!'));
        }
    }
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Caminhos dos arquivos JSON no novo diretório 'data'
const productsFilePath = path.join(__dirname, 'data', 'products.json');
const usersFilePath = path.join(__dirname, 'data', 'users.json');
const locationsFilePath = path.join(__dirname, 'data', 'locations.json');

let cart = [];
const currentUserEmail = 'carlos.victor@alu.ufc.br'; // Simulação de usuário atual

const loadProducts = async () => {
    const data = await fs.readFile(productsFilePath, 'utf-8');
    return JSON.parse(data);
};

const loadUsers = async () => {
    const data = await fs.readFile(usersFilePath, 'utf-8');
    return JSON.parse(data);
};

const saveUsers = async (users) => {
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
};
const saveProducts = async (products) => {
    await fs.writeFile(productsFilePath, JSON.stringify(products, null, 2), 'utf-8');
};

const loadLocations = async () => {
    const data = await fs.readFile(locationsFilePath, 'utf-8');
    return JSON.parse(data);
};

function isLoggedIn(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ message: 'Usuário não autenticado' });
    }
}

// Middleware para verificar se o usuário tem a role necessária
function hasRole(role) {
    return function (req, res, next) {
        if (req.session.user && req.session.user.role === role) {
            next();
        } else {
            res.status(403).json({ message: 'Acesso negado. Permissão insuficiente.' });
        }
    };
}

// Middleware para verificar múltiplos papéis
function hasAnyRole(roles) {
    return function (req, res, next) {
        if (req.session.user && roles.includes(req.session.user.role)) {
            next();
        } else {
            res.status(403).json({ message: 'Acesso negado. Permissão insuficiente.' });
        }
    };
}

// API para obter produtos
app.get('/api/products', async (req, res) => {
    try {
        const products = await loadProducts();
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao carregar produtos' });
    }
});

// API para obter um produto específico
app.get('/api/products/:id', async (req, res) => {
    const productId = parseInt(req.params.id);
    try {
        const products = await loadProducts();
        const product = products.find(p => p.id === productId);
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: 'Produto não encontrado' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar produto' });
    }
});

app.post('/api/products', upload.fields([
    { name: 'images', maxCount: 5 }, // Suporta até 5 imagens
    { name: 'video', maxCount: 1 }   // Suporta 1 vídeo
]), async (req, res) => {
    try {

        
        const { name, brand, rating, price, availability, categories, description} = req.body;

        userEmail =req.body.userEmail;

        if (!userEmail) {
            return res.status(400).json({ success: false, message: 'Email do usuário é obrigatório.' });
        }

        // Manipulando o upload de arquivos
        let images = [];
        if (req.files['images']) {
            images = req.files['images'].map(file => `/uploads/images/${file.filename}`);
        }

        let video = null;
        if (req.files['video'] && req.files['video'][0]) {
            video = `/uploads/videos/${req.files['video'][0].filename}`;
        }
        
        const products = await loadProducts();
        const users = await loadUsers();

        const newProduct = {
            id: products.length + 1,
            name,
            seller: userEmail, // O vendedor é definido pelo usuário logado
            brand,
            rating: parseInt(rating),
            price: parseFloat(price),
            availability,
            categories: categories.split(',').map(c => c.trim()),
            images: images,
            video: video,
            description: description.split('\n')
        };

        const user = users.find(u => u.email === userEmail);
            if (user) {
                user.products = user.products || [];
                user.products.push(newProduct.id); // Adicionar o ID do novo produto
                await saveUsers(users); // Salvar o usuário atualizado
            }

        products.push(newProduct);
        await saveProducts(products);

        res.json({ success: true, product: newProduct });
    } catch (error) {
        console.error('Erro ao criar produto:', error);
        res.status(500).json({ success: false, message: 'Erro ao criar o produto' });
    }
});


app.put('/api/products/:id', isLoggedIn, hasAnyRole(['admin', 'seller']), upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'video', maxCount: 1 }
]), async (req, res) => {
    const { id } = req.params;
    const { name, brand, rating, price, availability, categories, description } = req.body;

    try {
        const products = await loadProducts();
        const product = products.find(p => p.id === parseInt(id));

        if (!product) {
            return res.status(404).json({ message: 'Produto não encontrado' });
        }

        // Verificar se o usuário tem permissão para editar o produto
        if (req.session.user.role === 'seller' && req.session.user.name !== product.seller) {
            return res.status(403).json({ message: 'Acesso negado. Apenas o vendedor original pode editar este produto.' });
        }

        // Manipulando o upload de arquivos
        if (req.files['images']) {
            product.images = req.files['images'].map(file => `/uploads/images/${file.filename}`);
        }

        if (req.files['video'] && req.files['video'][0]) {
            product.video = `/uploads/videos/${req.files['video'][0].filename}`;
        }

        // Atualizar o produto
        product.name = name;
        product.brand = brand;
        product.rating = parseInt(rating);
        product.price = parseFloat(price);
        product.availability = availability;
        product.categories = categories.split(',').map(c => c.trim());
        product.description = description.split('\n');

        await saveProducts(products);

        res.json({ success: true, product });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao editar o produto' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const userRole = req.body.role; // Papel do usuário
    const userEmail = req.body.email; // Email do usuário logado (para verificar o vendedor)

    try {
        const products = await loadProducts();
        const productIndex = products.findIndex(p => p.id === parseInt(id));
        const product = products[productIndex];

        if (productIndex === -1) {
            return res.status(404).json({ message: 'Produto não encontrado' });
        }

        // Verifica se o usuário é admin ou o vendedor que criou o produto
        if (userRole === 'admin' || (userRole === 'seller' && product.sellerEmail === userEmail)) {
            products.splice(productIndex, 1); // Remove o produto
            await saveProducts(products);
            return res.json({ success: true, message: 'Produto removido com sucesso.' });
        } else {
            return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para deletar este produto.' });
        }
    } catch (error) {
        console.error('Erro ao remover o produto:', error);
        res.status(500).json({ message: 'Erro ao remover o produto' });
    }
});




// API para obter o carrinho
app.get('/api/cart', (req, res) => {
    res.json(cart);
});

// API para adicionar ao carrinho
app.put('/api/cart', async (req, res) => {
    const { id, quantity } = req.body;
    const products = await loadProducts(); // Carregar produtos do JSON
    const product = products.find(p => p.id === parseInt(id)); // Encontrar produto pelo ID

    if (!product) {
        return res.status(404).json({ success: false, message: 'Produto não encontrado' });
    }

    const itemIndex = cart.findIndex(item => item.id === parseInt(id));

    if (itemIndex > -1) {
        if (parseInt(quantity) === 0) {
            cart.splice(itemIndex, 1); // Remover o item se a quantidade for 0
            console.log('Produto removido do carrinho:', id);
        } else {
            cart[itemIndex].quantity = parseInt(quantity); // Atualizar quantidade
            console.log('Quantidade atualizada para o produto:', cart[itemIndex].quantity);
        }
    } else {
        // Adicionar produto ao carrinho
        cart.push({ ...product, quantity: parseInt(quantity) });
        console.log('Produto adicionado ao carrinho:', { id: product.id, quantity: parseInt(quantity) });
    }

    res.json({ success: true, cart });
});

app.delete('/api/cart/:id', (req, res) => {
    const { id } = req.params;
    const itemIndex = cart.findIndex(item => item.id === parseInt(id));

    if (itemIndex > -1) {
        cart.splice(itemIndex, 1); // Remover o produto do carrinho
        console.log('Produto removido do carrinho:', id);
        res.json({ success: true, message: 'Produto removido do carrinho.' });
    } else {
        res.status(404).json({ success: false, message: 'Produto não encontrado no carrinho.' });
    }
});

// API para limpar o carrinho
app.delete('/api/cart', (req, res) => {
    cart = [];
    res.json({ success: true });
});

app.post('/api/cart/buy-now', async (req, res) => {
    try {
        // Carregar os produtos apenas quando necessário
        const productsData = await loadProducts(); 
        console.log('Dados recebidos no POST /api/cart/buy-now:', req.body);

        const { id, quantity } = req.body;
        console.log('ID do Produto:', id);
        console.log('Quantidade:', quantity);

        const product = productsData.find(p => p.id === parseInt(id));

        if (product) {
            const cartItem = cart.find(item => item.id === product.id);

            if (cartItem) {
                cartItem.quantity += parseInt(quantity);
                console.log('Produto já no carrinho, nova quantidade:', cartItem.quantity);
            } else {
                cart.push({
                    ...product,
                    quantity: parseInt(quantity)
                });
                console.log('Produto adicionado ao carrinho:', { id: product.id, quantity: parseInt(quantity) });
            }

            res.redirect('http://localhost:8090/cart');
        } else {
            res.status(404).json({ success: false, message: 'Produto não encontrado.' });
        }
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        res.status(500).json({ success: false, message: 'Erro ao processar a compra.' });
    }
});



// API para submeter checkout
app.post('/api/checkout', async (req, res) => {
    const { first_name, last_name, company_name, address, country, state, city, zip_code, email, phone_number, pix_name, order_notes, pix_receipt } = req.body;
    try {
        const users = await loadUsers();
        const newUser = {
            first_name, last_name, company_name, address, country, state, city, zip_code, email, phone_number, pix_name,
            pix_receipt, order_notes, order_items: cart, order_total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
            order_date: new Date().toISOString()
        };
        users.push(newUser);
        await saveUsers(users);
        cart = [];
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao submeter checkout' });
    }
});

// API para obter localizações
app.get('/api/locations', async (req, res) => {
    try {
        const locations = await loadLocations();
        res.json(locations);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao carregar localizações' });
    }
});

// API para obter compras recentes de um usuário específico
app.get('/api/recent-purchases', async (req, res) => {
    try {
        const users = await loadUsers();
        const user = users.find(user => user.email === currentUserEmail);

        if (user && user.orders) {
            res.json(user.orders);
        } else {
            res.status(404).json({ message: 'No orders found for this user.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar compras recentes' });
    }
});

// API para obter detalhes do perfil de um usuário específico
app.get('/api/profile-details', async (req, res) => {
    try {
        const users = await loadUsers();
        const user = users.find(user => user.email === currentUserEmail);

        if (user) {
            res.json({
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                phone_number: user.phone_number,
                address: user.address,
                city: user.city,
                state: user.state,
                country: user.country
            });
        } else {
            res.status(404).json({ message: 'User not found.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar detalhes do perfil' });
    }
});

// API para login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const users = await loadUsers();
        const user = users.find(u => u.email === email && u.password === password);

        if (user) {
            res.json({ success: true, user });
        } else {
            res.json({ success: false, message: 'Invalid email or password' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Error during login' });
    }
});

// API para signup
app.post('/api/signup', async (req, res) => {
    const { email, password, name, role } = req.body;
    try {
        const users = await loadUsers();
        const existingUser = users.find(u => u.email === email);

        if (existingUser) {
            res.json({ success: false, message: 'User already exists' });
        } else {
            const newUser = { email, password, name, role };
            users.push(newUser);
            await saveUsers(users);
            res.json({ success: true });
        }
    } catch (err) {
        res.status(500).json({ message: 'Error during signup' });
    }
});

// Inicialização do servidor
const porta = 8091;
app.listen(porta, () => {
    console.log('API server listening on port ' + porta);
});
