// serverB.js - Servidor B (API)
const express = require('express');
const path = require('path');
const fs = require('fs').promises;   
const bodyParser = require('body-parser');
const app = express();

const cors = require('cors');
app.use(cors());


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Caminhos dos arquivos JSON no novo diretório 'data'
const productsFilePath = path.join(__dirname, 'data', 'products.json');
const usersFilePath = path.join(__dirname, 'data', 'users.json');
const locationsFilePath = path.join(__dirname, 'data', 'locations.json');

let cart = [];
const currentUserEmail = 'carlos.victor@alu.ufc.br'; // Simulação de usuário atual

// Função para carregar produtos
const loadProducts = async () => {
    const data = await fs.readFile(productsFilePath, 'utf-8');
    return JSON.parse(data);
};

// Função para carregar usuários
const loadUsers = async () => {
    const data = await fs.readFile(usersFilePath, 'utf-8');
    return JSON.parse(data);
};

// Função para salvar usuários
const saveUsers = async (users) => {
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
};

// Função para carregar localizações
const loadLocations = async () => {
    const data = await fs.readFile(locationsFilePath, 'utf-8');
    return JSON.parse(data);
};

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

// Inicialização do servidor
const porta = 8091;
app.listen(porta, () => {
    console.log('API server listening on port ' + porta);
});
