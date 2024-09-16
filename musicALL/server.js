const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const expressLayouts = require('express-ejs-layouts');
const app = express();
const multer = require('multer');

// Configuração do EJS como motor de visualização e uso de layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main'); // Define o layout principal

// Middleware para servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
const upload = multer({ dest: 'uploads/' });
app.use(bodyParser.urlencoded({ extended: true })); 


// Carregar dados do JSON
const productsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'products.json'), 'utf-8'));

let cart = [];

// carrega dados dos users

const usersFilePath = path.join(__dirname, 'data', 'users.json');
const loadUsers = () => {
    try {
        const usersData = fs.readFileSync(usersFilePath, 'utf-8');
        return JSON.parse(usersData);
    } catch (err) {
        console.error('Erro ao ler o arquivo users.json', err);
        return [];
    }
};

// salvar os dados no arquivo usuarios.json
const saveUsers = (users) => {
    try {
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
    } catch (err) {
        console.error('Erro ao salvar no arquivo users.json', err);
    }
};

if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

app.get('/search', (req, res) => {
    const query = req.query.query.toLowerCase(); // Captura o termo de busca
    const productsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'products.json'), 'utf-8'));

    // filtra produtos que o nome inclua o termo de busca
    const filteredProducts = productsData.filter(product => product.name.toLowerCase().includes(query));

    // renderiza a página de resultados de busca
    res.render('pages/searchResults', {
        title: `Search Results for "${req.query.query}"`,
        cssFile: null,
        products: filteredProducts
        
    });
});


app.post('/cart/buy-now', (req, res) => {
    const { id, quantity } = req.body;
    const product = productsData.find(p => p.id === parseInt(id));
  
    if (product) {
        const cartItem = cart.find(item => item.id === product.id);
  
        if (!cartItem) {
            // adiciona o produto ao carrinho com a quantidade especificada
            cart.push({
                ...product,
                quantity: parseInt(quantity)
            });
        }
  
        // redireciona pro carrinho depois adicionar o produto
        res.redirect('/cart');
    } else {
        res.status(404).send('Produto não encontrado');
    }
  });

app.post('/cart', (req, res) => {
  const { id, quantity } = req.body; // pega o ID e a quantidade do corpo da requisição

  // buscar o produto no JSON usando o ID
  const product = productsData.find(p => p.id === parseInt(id));

  if (product) {
      // verifica se o produto já tá no carrinho
      const productExists = cart.find(item => item.id === id);

      if (productExists) {
          // atualiza a quantidade se o produto já tá no carrinho
          productExists.quantity += parseInt(quantity);
      } else {
          // Adiciona o produto ao carrinho
          cart.push({
              ...product, // adiciona todas as infos do produto
              quantity: parseInt(quantity) // adiciona a quantidade
          });
      }

      res.json({ success: true, message: 'Produto adicionado ao carrinho', cart });
  } else {
      res.status(404).json({ success: false, message: 'Produto não encontrado' });
  }
});

// rota principal para a home
app.get('/', (req, res) => {
    res.render('pages/index', { 
        title: 'Home', 
        cssFile: null,
        products: productsData
    });
});

app.get('/product/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const product = productsData.find(p => p.id === productId); 

  if (product) {
      res.render('pages/product', {
         title: 'Produto',
         product,
         cssFile: 'css/styles/product-page.css' });
  } else {
      res.status(404).send('Produto não encontrado');
  }
});

app.get('/cart', (req, res) => {
  res.render('pages/cart', { title: 'Seu Carrinho', cart: cart, cssFile:'css/styles/cart.css' });
});

app.post('/cart/remove', (req, res) => {
  const { id } = req.body;
  cart = cart.filter(item => item.id !== parseInt(id));
  res.json({ success: true });
});

app.post('/cart/update', (req, res) => {
  const { id, quantity } = req.body;
  const item = cart.find(item => item.id === parseInt(id));

  if (item) {
      item.quantity = parseInt(quantity);
      res.json({ success: true });
  } else {
      res.status(404).json({ success: false, message: 'Item não encontrado no carrinho' });
  }
});


const locationData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'locations.json'), 'utf-8'));

app.get('/checkout', (req, res) => {
    let subtotal = 0;

    // Calcula o subtotal com base nos itens do carrinho
    if (cart && cart.length > 0) {
        subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    }

    res.render('pages/checkout', { 
        title: 'Checkout', 
        cssFile: 'css/styles/checkout.css', 
        cart: cart,
        subtotal: subtotal,
        locationData
    });
});

app.post('/submit-checkout', upload.single('pix_receipt'), (req, res) => {
    const { first_name, last_name, company_name, address, country, state, city, zip_code, email, phone_number, pix_name, order_notes } = req.body;

    const users = loadUsers(); // Carregar usuários existentes

    // verifica se o arquivo PIX receipt foi enviado
    const pix_receipt = req.file ? req.file.filename : null;

    // criar novo usuário/pedido com as informações de checkout e os itens do carrinho
    const newUser = {
        first_name,
        last_name,
        company_name,
        address,
        country,
        state,
        city,
        zip_code,
        email,
        phone_number,
        pix_name,
        pix_receipt,  // nome do arquivo PIX receipt
        order_notes,
        order_items: cart, // itens do carrinho
        order_total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0), // total 
        order_date: new Date().toISOString() // data 
    };

    // adiciona novo pedido ao users
    users.push(newUser);

    // salva no json
    saveUsers(users);

    // esvazia o carrinho
    cart = [];

    // redireciona para a página de confirmação
    res.redirect('/finished');
});


app.get('/finished', (req, res) => {
    res.render('pages/finished', {
        title: 'Payment Successful',
        cssFile: 'css/styles/finished.css'
    });
});

app.get('/signup', (req, res) => {
    res.render('pages/signup', {
        title: 'Sign up',
        cssFile: 'css/styles/login.css'
    });
});

app.get('/login', (req, res) => {
    res.render('pages/login', {
        title: 'Login',
        cssFile: 'css/styles/login.css'
    });
});

app.get('/profile', (req, res) => {
    res.render('pages/profile', {
        title: 'Profile',
        cssFile: 'css/styles/profile.css'
    });
});

app.get('/profile_config', (req, res) => {
    res.render('pages/profile_config', {
        title: 'Profile Config',
        cssFile: 'css/styles/profile_config.css'
    });
});

const currentUserEmail = 'carlos.victor@alu.ufc.br'

// Obter compras recentes de um usuario especifico
app.get('/api/recent-purchases', (req, res) => {
    const users = loadUsers();
    const user = users.find(user => user.email === currentUserEmail); // Usuario

    if (user && user.orders) {
        res.json(user.orders);
    } else {
        res.status(404).json({ message: 'No orders found for this user.' });
    }
});

// Obter detalhes do perfil de um usuario
app.get('/api/profile-details', (req, res) => {
    const users = loadUsers();
    const user = users.find(user => user.email === currentUserEmail); // Usuario

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
});

// Inicialização do servidor
const porta = 8090
app.listen(porta, () => {
  console.log('Server listening on port '+porta)
})
