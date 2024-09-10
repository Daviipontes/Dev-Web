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

// Função para salvar os dados no arquivo usuarios.json
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

    // Filtrar produtos cujo nome inclua o termo de busca
    const filteredProducts = productsData.filter(product => product.name.toLowerCase().includes(query));

    // Renderizar a página principal, mas passando os produtos filtrados
    res.render('pages/index', {
        title: `Search Results for "${req.query.query}"`,
        cssFile: null, // Ou outro CSS que já é usado na página principal
        products: filteredProducts,
        query: req.query.query,
        showSearchResults: true  // Passa uma flag para indicar que é uma busca
    });
});


app.get('/filter', (req, res) => {
    const { category, price, brand } = req.query;
    let filteredProducts = productsData;

    // Filtro por categoria
    if (category) {
        const categoriesArray = Array.isArray(category) ? category : [category];
        filteredProducts = filteredProducts.filter(product => 
            categoriesArray.some(cat => product.categories.includes(cat))
        );
    }

    // Filtro por faixa de preço
    if (price) {
        switch (price) {
            case 'under-200':
                filteredProducts = filteredProducts.filter(product => product.price < 200);
                break;
            case '200-500':
                filteredProducts = filteredProducts.filter(product => product.price >= 200 && product.price <= 500);
                break;
            case '500-1000':
                filteredProducts = filteredProducts.filter(product => product.price >= 500 && product.price <= 1000);
                break;
            case '1000-5000':
                filteredProducts = filteredProducts.filter(product => product.price >= 1000 && product.price <= 5000);
                break;
            case 'over-5000':
                filteredProducts = filteredProducts.filter(product => product.price > 5000);
                break;
        }
    }

    // Filtro por marca
    if (brand) {
        const brandsArray = Array.isArray(brand) ? brand : [brand];
        filteredProducts = filteredProducts.filter(product => 
            brandsArray.includes(product.brand)
        );
    }

    // Renderiza a página com os produtos filtrados
    res.render('pages/index', {
        title: 'Filtered Products',
        products: filteredProducts,
        cssFile: null
    });
});


app.post('/cart/buy-now', (req, res) => {
    const { id, quantity } = req.body;
    const product = productsData.find(p => p.id === parseInt(id));
  
    if (product) {
        const cartItem = cart.find(item => item.id === product.id);
  
        if (!cartItem) {
            // Adiciona o produto ao carrinho com a quantidade especificada
            cart.push({
                ...product,
                quantity: parseInt(quantity)
            });
        }
  
        // Redireciona para o carrinho após adicionar o produto
        res.redirect('/cart');
    } else {
        res.status(404).send('Produto não encontrado');
    }
  });

app.post('/cart', (req, res) => {
  const { id, quantity } = req.body; // Pegue o ID e a quantidade do corpo da requisição

  // Buscar o produto no JSON usando o ID
  const product = productsData.find(p => p.id === parseInt(id));

  if (product) {
      // Verificar se o produto já está no carrinho
      const productExists = cart.find(item => item.id === id);

      if (productExists) {
          // Atualizar a quantidade se o produto já está no carrinho
          productExists.quantity += parseInt(quantity);
      } else {
          // Adicionar o produto ao carrinho
          cart.push({
              ...product, // Adiciona todas as informações do produto
              quantity: parseInt(quantity) // Adiciona a quantidade
          });
      }

      res.json({ success: true, message: 'Produto adicionado ao carrinho', cart });
  } else {
      res.status(404).json({ success: false, message: 'Produto não encontrado' });
  }
});

// Rota principal para a página inicial
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

    // Verifica se o arquivo PIX receipt foi enviado
    const pix_receipt = req.file ? req.file.filename : null;

    // Criar novo usuário/pedido com as informações de checkout e os itens do carrinho
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
        pix_receipt,  // Nome do arquivo PIX receipt
        order_notes,
        order_items: cart, // Itens do carrinho
        order_total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0), // Total do pedido
        order_date: new Date().toISOString() // Data do pedido
    };

    // Adicionar novo pedido
    users.push(newUser);

    // Salvar no arquivo users.json
    saveUsers(users);

    // Esvaziar o carrinho
    cart = [];

    // Redirecionar para a página de confirmação
    res.redirect('/finished');
});


app.get('/finished', (req, res) => {
    res.render('pages/finished', {
        title: 'Payment Successful',
        cssFile: 'css/styles/finished.css'
    });
});



// Inicialização do servidor
const porta = 8090
app.listen(porta, () => {
  console.log('Server listening on port '+porta)
})
