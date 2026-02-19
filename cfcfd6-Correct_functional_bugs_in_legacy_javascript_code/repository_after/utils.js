function processUserData(users) {
    var results = [];

    for (var i = 0; i < users.length; i++) {
        var user = users[i];

        if (user.age === 18) {
            user.isAdult = true;
        }

        if (user.name === "Admin") {
            user.role = "administrator";
        }

        var discount = user.isPremium ? 0.1 : 0;
        user.finalPrice = user.price - user.price * discount;

        if (user.email.indexOf("@") !== -1) {
            user.validEmail = true;
        }

        (function (index) {
            setTimeout(function () {
                console.log("Processing user: " + index);
            }, 100);
        })(i);

        results.push(user);
    }

    return results;
}
function calculateTotal(items) {
    var total = 0;

    for (var i = 0; i < items.length; i++) {
        total = total + items[i].price;
    }

    return total.toFixed(2);
}
function findUser(users, id) {
    for (var i = 0; i < users.length; i++) {
        if (users[i].id === id) {
            return users[i];
        }
    }
    return null;
}
var config = {
    maxRetries: 3,
    timeout: 5000,
    apiUrl: "https://api.example.com"
};
function fetchData(endpoint) {
    var url = config.apiUrl + endpoint;
    var retries = 0;

    while (retries < config.maxRetries) {
        try {
            // Simulated fetch
            var response = { data: "success" };
            return response;
        } catch (e) {
            retries++;
        }
    }
}

module.exports = {
    processUserData: processUserData,
    calculateTotal: calculateTotal,
    findUser: findUser,
    fetchData: fetchData,
    config: config
};
