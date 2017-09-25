
var schema = {
    name: "sales",
    tables : [
            { "name": "customers"
            , "row_alias": ["name", "email"]
            , "fields": [
                {
                        "name": "id"
                    , "type": "integer"
                    , "props": {
                        "order": 0
                    }
                }
                , {
                        "name": "name"
                    , "type": "text"
                    , "props": {
                        "width": 40
                        , "order": 1
                    }
                }
                , {
                        "name": "email"
                    , "type": "text(256)"
                    , "props": {
                        "width": 60
                        , "order": 2
                    }
                }
                , {
                        "name": "mod_by"
                    , "type": "text(64)"
                    , "props": {
                        "order": 91
                    }
                }
                , {
                        "name": "mod_on"
                    , "type": "timestamp"
                    , "props": {
                        "order": 92,
                        "width": 11
                    }
                }
                , {
                        "name": "add_by"
                    , "type": "text(64)"
                    , "props": {
                        "order": 93
                    }
                }
                , {
                        "name": "add_on"
                    , "type": "timestamp"
                    , "props": {
                        "order": 94,
                        "width": 11
                    }
                }
                , {
                        "name": "own_by"
                    , "type": "text(64)"
                    , "props": {
                        "order": 95
                    }
                }
                ]
            }
        , { "name": "products"
            , "row_alias": ["name"]		  	
            , "fields": [
                {
                        "name": "id"
                    , "type": "integer"
                    , "props": {
                        "order": 0
                    }
                }
                , {
                        "name": "name"
                    , "type": "text"
                    , "props": {
                        "width": 30
                        , "order": 1
                    }
                }
                , {
                        "name": "price"
                    , "type": "decimal(8,2)"
                    , "props": {
                        "scale": 2
                        , "order": 2
                    }
                }
                , {
                        "name": "mod_by"
                    , "type": "text(64)"
                    , "props": {
                        "order": 91
                    }
                }
                , {
                        "name": "mod_on"
                    , "type": "timestamp"
                    , "props": {
                        "order": 92,
                        "width": 11
                    }
                }
                , {
                        "name": "add_by"
                    , "type": "text(64)"
                    , "props": {
                        "order": 93
                    }
                }
                , {
                        "name": "add_on"
                    , "type": "timestamp"
                    , "props": {
                        "order": 94,
                        "width": 11
                    }
                }
                , {
                        "name": "own_by"
                    , "type": "text(64)"
                    , "props": {
                        "order": 95
                    }
                }
            ]		
            }
        , { "name": "orders"
            , "row_alias": ["order_date", "customers.name"]		  	
            , "fields": [
                {
                        "name": "id"
                    , "type": "integer"
                    , "props": {
                        "order": 0
                    }
                }
                , {
                        "name": "order_date"
                    , "type": "date"
                    , "props": {
                        "order": 1
                    }
                }
                , {
                        "name": "customer_id"
                    , "type": "integer"
                    , "fk_table": "customers"
                    , "props": {
                        "order": 2
                        , "width": 40
                    }
                }
                , {
                        "name": "total_amount"
                    , "type": "decimal(8,2)"
                    , "props": {
                        "scale": 2
                        , "width": 12
                        , "order": 3
                    }
                }
                , {
                        "name": "mod_by"
                    , "type": "text(64)"
                    , "props": {
                        "order": 91
                    }
                }
                , {
                        "name": "mod_on"
                    , "type": "timestamp"
                    , "props": {
                        "order": 92,
                        "width": 11
                    }
                }
                , {
                        "name": "add_by"
                    , "type": "text(64)"
                    , "props": {
                        "order": 93
                    }
                }
                , {
                        "name": "add_on"
                    , "type": "timestamp"
                    , "props": {
                        "order": 94,
                        "width": 11
                    }
                }
                , {
                        "name": "own_by"
                    , "type": "text(64)"
                    , "props": {
                        "order": 95
                    }
                }
            ]		
            }
        , { "name": "products_in_orders"
            , "fields": [
                {
                        "name": "id"
                    , "type": "integer"
                    , "props": {
                        "order": 0
                    }
                }
                , {
                        "name": "order_id"
                    , "type": "integer"
                    , "fk_table": "orders"
                    , "props": {
                        "order": 1
                        , "width": 40
                    }
                }
                , {
                        "name": "product_id"
                    , "type": "integer"
                    , "fk_table": "products"
                    , "props": {
                        "order": 2
                        , "width": 30
                    }
                }
                , {
                        "name": "unit_price"
                    , "type": "decimal(8,2)"
                    , "props": {
                        "scale": 2
                        , "order": 3
                    }
                }
                , {
                        "name": "quantity"
                    , "type": "integer"
                    , "props": {
                        "order": 4
                    }
                }
                , {
                        "name": "mod_by"
                    , "type": "text(64)"
                    , "props": {
                        "order": 91
                    }
                }
                , {
                        "name": "mod_on"
                    , "type": "timestamp"
                    , "props": {
                        "order": 92,
                        "width": 11
                    }
                }
                , {
                        "name": "add_by"
                    , "type": "text(64)"
                    , "props": {
                        "order": 93
                    }
                }
                , {
                        "name": "add_on"
                    , "type": "timestamp"
                    , "props": {
                        "order": 94,
                        "width": 11
                    }
                }
                , {
                      "name": "own_by"
                    , "type": "text(64)"
                    , "props": {
                        "order": 95
                    }
                }
            ]		
        }
    ]
    
};

var data = {

    customers: [
        {"id":1,"name":"Daniel","email":"dkottow@gmail.com","mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"Daniel dkottow@gmail.com [1]"},
        {"id":2,"name":"Maria","email":"maria@foo.mail","mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"Maria maria@foo.mail [2]"}
    ],

    products: [
        {"id":1,"name":"Car","price":9000,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"Car [1]"},
        {"id":2,"name":"Apple","price":0.99,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"Apple [2]"},
        {"id":3,"name":"Doll","price":29.5,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"Doll [3]"},
        {"id":4,"name":"Book","price":12,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"Book [4]"}
    ],

    orders: [
        {"id":1,"order_date":"2015-01-16","customer_id":1,"total_amount":113.28,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"2015-01-16 Daniel [1]","customer_ref":"Daniel dkottow@gmail.com [1]"},
        {"id":2,"order_date":"2015-01-13","customer_id":1,"total_amount":29.5,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"2015-01-13 Daniel [2]","customer_ref":"Daniel dkottow@gmail.com [1]"},
        {"id":3,"order_date":"2015-01-12","customer_id":1,"total_amount":9000,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"2015-01-12 Daniel [3]","customer_ref":"Daniel dkottow@gmail.com [1]"},
        {"id":4,"order_date":"2015-01-15","customer_id":2,"total_amount":18031.48,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"2015-01-15 Maria [4]","customer_ref":"Maria maria@foo.mail [2]"},
        {"id":5,"order_date":"2015-01-02","customer_id":1,"total_amount":50.5,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"2015-01-02 Daniel [5]","customer_ref":"Daniel dkottow@gmail.com [1]"},
        {"id":6,"order_date":"2015-01-02","customer_id":1,"total_amount":60.5,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"2015-01-02 Daniel [6]","customer_ref":"Daniel dkottow@gmail.com [1]"},
        {"id":7,"order_date":"2015-01-02","customer_id":1,"total_amount":70.5,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"2015-01-02 Daniel [7]","customer_ref":"Daniel dkottow@gmail.com [1]"},
        {"id":8,"order_date":"2015-01-02","customer_id":1,"total_amount":80.5,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"2015-01-02 Daniel [8]","customer_ref":"Daniel dkottow@gmail.com [1]"},
        {"id":9,"order_date":"2015-01-02","customer_id":1,"total_amount":90.5,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"2015-01-02 Daniel [9]","customer_ref":"Daniel dkottow@gmail.com [1]"},
        {"id":10,"order_date":"2015-01-02","customer_id":1,"total_amount":100.5,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"2015-01-02 Daniel [10]","customer_ref":"Daniel dkottow@gmail.com [1]"}
    ],

    products_in_orders: [
        {"id":1,"order_id":1,"product_id":4,"unit_price":12,"quantity":2,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"[1]","order_ref":"2015-01-16 Daniel [1]","product_ref":"Book [4]"},
        {"id":2,"order_id":1,"product_id":3,"unit_price":29.5,"quantity":1,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"[2]","order_ref":"2015-01-16 Daniel [1]","product_ref":"Doll [3]"},
        {"id":3,"order_id":3,"product_id":1,"unit_price":9000,"quantity":1,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"[3]","order_ref":"2015-01-12 Daniel [3]","product_ref":"Car [1]"},
        {"id":4,"order_id":2,"product_id":4,"unit_price":9.8,"quantity":2,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"[4]","order_ref":"2015-01-13 Daniel [2]","product_ref":"Book [4]"},
        {"id":5,"order_id":2,"product_id":2,"unit_price":0.99,"quantity":10,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"[5]","order_ref":"2015-01-13 Daniel [2]","product_ref":"Apple [2]"},
        {"id":6,"order_id":1,"product_id":2,"unit_price":0.99,"quantity":20,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"[6]","order_ref":"2015-01-16 Daniel [1]","product_ref":"Apple [2]"},
        {"id":7,"order_id":1,"product_id":3,"unit_price":19.99,"quantity":2,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"[7]","order_ref":"2015-01-16 Daniel [1]","product_ref":"Doll [3]"},
        {"id":8,"order_id":4,"product_id":2,"unit_price":0.99,"quantity":2,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"[8]","order_ref":"2015-01-15 Maria [4]","product_ref":"Apple [2]"},
        {"id":9,"order_id":4,"product_id":1,"unit_price":9000,"quantity":2,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"[9]","order_ref":"2015-01-15 Maria [4]","product_ref":"Car [1]"},
        {"id":10,"order_id":4,"product_id":3,"unit_price":29.5,"quantity":1,"mod_by":"sql","mod_on":"2017-05-16 15:22:31","add_by":"sql","add_on":"2017-05-16 15:22:31","own_by":null,"ref":"[10]","order_ref":"2015-01-15 Maria [4]","product_ref":"Doll [3]"}    
    ]

};

module.exports = {
    schema: schema, data: data
}