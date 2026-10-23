/* Каталог стартовых рецептов по профессиям (ставится кнопкой из настроек модуля).
   Иконки - собственная графика модуля (assets/icons), ничего платного.
   Цены, вес и сложность выставлены по правилам «Создание предмета» (Книга правил, стр. 199). */

export const STARTER_CATALOGUE = [
  {
    "key": "apothecary",
    "skill": "Ремесло (Аптекарь)",
    "label": "Аптекарь",
    "ingredients": [
      {
        "name": "Целебные травы",
        "img": "earth-root.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 4
        },
        "availability": "common",
        "description": "Пучок сушёных трав, собранных в лесах Империи."
      },
      {
        "name": "Спирт очищенный",
        "img": "spirits-pint.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 6
        },
        "availability": "common",
        "description": "Крепкий спирт, основа для многих настоек."
      },
      {
        "name": "Корень мандрагоры",
        "img": "mandrake-root.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 1,
          "bp": 0
        },
        "availability": "common",
        "description": "Корень с тёмной репутацией, ценится за бодрящие свойства."
      },
      {
        "name": "Стеклянный флакон",
        "img": "raw-materials.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 3
        },
        "availability": "common",
        "description": "Пузырёк тёмного стекла с притёртой пробкой."
      }
    ],
    "recipes": [
      {
        "name": "Лечебная настойка",
        "type": "trapping",
        "trappingType": "drugsPoisonsHerbsDraughts",
        "img": "healing-draught.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 1,
          "bp": 0
        },
        "availability": "common",
        "description": "Мутная горькая жидкость, от которой раны затягиваются быстрее, а руки перестают дрожать.",
        "count": 1,
        "difficulty": "average",
        "slTarget": 10,
        "ingredients": [
          {
            "name": "Целебные травы",
            "count": 2
          },
          {
            "name": "Спирт очищенный",
            "count": 1
          }
        ],
        "moneyBp": 3,
        "needsWorkshop": false,
        "timeDays": 0,
        "timeHours": 1,
        "timeMinutes": 0,
        "upgrades": [
          {
            "quality": "fine",
            "count": 1,
            "ingredientName": "Стеклянный флакон",
            "moneyBp": 6
          }
        ],
        "crit": {
          "sl": 8,
          "qualities": [
            "practical"
          ],
          "refund": true
        }
      },
      {
        "name": "Противоядие",
        "type": "trapping",
        "trappingType": "drugsPoisonsHerbsDraughts",
        "img": "antitoxin-kit.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 1,
          "bp": 6
        },
        "availability": "common",
        "description": "Едкая смесь, вытягивающая яд из крови — если успеешь выпить вовремя.",
        "count": 1,
        "difficulty": "challenging",
        "slTarget": 10,
        "ingredients": [
          {
            "name": "Целебные травы",
            "count": 1
          },
          {
            "name": "Корень мандрагоры",
            "count": 1
          },
          {
            "name": "Спирт очищенный",
            "count": 1
          }
        ],
        "moneyBp": 4,
        "needsWorkshop": true,
        "timeDays": 0,
        "timeHours": 2,
        "timeMinutes": 0
      },
      {
        "name": "Бодрящий эликсир",
        "type": "trapping",
        "trappingType": "drugsPoisonsHerbsDraughts",
        "img": "vitality-draught.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 2,
          "bp": 0
        },
        "availability": "common",
        "description": "Тёмный отвар с запахом кореньев, прогоняющий сон и усталость на пару часов.",
        "count": 1,
        "difficulty": "average",
        "slTarget": 10,
        "ingredients": [
          {
            "name": "Корень мандрагоры",
            "count": 2
          },
          {
            "name": "Спирт очищенный",
            "count": 1
          }
        ],
        "moneyBp": 6,
        "needsWorkshop": false,
        "timeDays": 0,
        "timeHours": 1,
        "timeMinutes": 30,
        "upgrades": [
          {
            "quality": "fine",
            "count": 1,
            "ingredientName": "Стеклянный флакон",
            "moneyBp": 12
          }
        ]
      }
    ]
  },
  {
    "key": "herbalist",
    "skill": "Ремесло (Травник)",
    "label": "Травник",
    "ingredients": [
      {
        "name": "Сальворт",
        "img": "salwort.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 3
        },
        "availability": "common",
        "description": "Скромная трава с болот, заживляет мелкие раны."
      },
      {
        "name": "Земляной корень",
        "img": "earth-root.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 2
        },
        "availability": "common",
        "description": "Корень, растущий в тени, успокаивает нервы."
      },
      {
        "name": "Льняная ткань",
        "img": "clothing.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 4
        },
        "availability": "common",
        "description": "Кусок грубой ткани для припарок и обёрток."
      }
    ],
    "recipes": [
      {
        "name": "Лечебная припарка",
        "type": "trapping",
        "trappingType": "drugsPoisonsHerbsDraughts",
        "img": "healing-poultice.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 8
        },
        "availability": "common",
        "description": "Тёплая травяная кашица на тряпице, оттягивающая боль и гной.",
        "count": 1,
        "difficulty": "average",
        "slTarget": 5,
        "ingredients": [
          {
            "name": "Сальворт",
            "count": 2
          },
          {
            "name": "Льняная ткань",
            "count": 1
          }
        ],
        "moneyBp": 2,
        "needsWorkshop": false,
        "timeDays": 0,
        "timeHours": 0,
        "timeMinutes": 30,
        "crit": {
          "sl": 8,
          "qualities": [
            "practical"
          ],
          "refund": true
        }
      },
      {
        "name": "Успокоительный отвар",
        "type": "trapping",
        "trappingType": "drugsPoisonsHerbsDraughts",
        "img": "digestive-tonic.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 10
        },
        "availability": "common",
        "description": "Горький отвар, после которого тревоги отступают, а сны приходят тяжёлые.",
        "count": 1,
        "difficulty": "average",
        "slTarget": 5,
        "ingredients": [
          {
            "name": "Земляной корень",
            "count": 2
          },
          {
            "name": "Сальворт",
            "count": 1
          }
        ],
        "moneyBp": 3,
        "needsWorkshop": false,
        "timeDays": 0,
        "timeHours": 1,
        "timeMinutes": 0,
        "upgrades": [
          {
            "quality": "fine",
            "count": 1,
            "ingredientName": "Льняная ткань",
            "moneyBp": 6
          }
        ]
      }
    ]
  },
  {
    "key": "cook",
    "skill": "Ремесло (Повар)",
    "label": "Повар",
    "ingredients": [
      {
        "name": "Крупа и мука",
        "img": "food-groceries-day.png",
        "enc": 1,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 4
        },
        "availability": "common",
        "description": "Мешок крупы и муки, основа дорожной еды."
      },
      {
        "name": "Солёное мясо",
        "img": "rations-1-day.png",
        "enc": 1,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 6
        },
        "availability": "common",
        "description": "Тёмный кусок вяленого мяса, переживёт любую дорогу."
      },
      {
        "name": "Коренья и овощи",
        "img": "earth-root.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 2
        },
        "availability": "common",
        "description": "Связка репы, лука и моркови с рынка."
      },
      {
        "name": "Эль",
        "img": "ale-pint.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 3
        },
        "availability": "common",
        "description": "Пинта жидкого эля — и для теста, и для повара."
      }
    ],
    "recipes": [
      {
        "name": "Дорожный паёк",
        "type": "trapping",
        "trappingType": "foodAndDrink",
        "img": "rations-1-day.png",
        "enc": 1,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 8
        },
        "availability": "common",
        "description": "Плотный ломоть хлеба с мясом и сыром, завёрнутый в тряпицу.",
        "count": 5,
        "difficulty": "average",
        "slTarget": 5,
        "ingredients": [
          {
            "name": "Крупа и мука",
            "count": 2
          },
          {
            "name": "Солёное мясо",
            "count": 1
          }
        ],
        "moneyBp": 2,
        "needsWorkshop": false,
        "timeDays": 0,
        "timeHours": 2,
        "timeMinutes": 0,
        "upgrades": [
          {
            "quality": "durable",
            "count": 1,
            "ingredientName": "Солёное мясо",
            "moneyBp": 4
          }
        ]
      },
      {
        "name": "Сытная похлёбка",
        "type": "trapping",
        "trappingType": "foodAndDrink",
        "img": "meal-inn.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 6
        },
        "availability": "common",
        "description": "Густой варево с мясом и кореньями, от которого тепло растекается по телу.",
        "count": 1,
        "difficulty": "average",
        "slTarget": 5,
        "ingredients": [
          {
            "name": "Коренья и овощи",
            "count": 2
          },
          {
            "name": "Солёное мясо",
            "count": 1
          },
          {
            "name": "Эль",
            "count": 1
          }
        ],
        "moneyBp": 2,
        "needsWorkshop": false,
        "timeDays": 0,
        "timeHours": 1,
        "timeMinutes": 30,
        "crit": {
          "sl": 8,
          "qualities": [
            "practical"
          ],
          "refund": true
        }
      }
    ]
  },
  {
    "key": "smith",
    "skill": "Ремесло (Кузнец)",
    "label": "Кузнец",
    "ingredients": [
      {
        "name": "Железный слиток",
        "img": "mithril-ingot.png",
        "enc": 1,
        "price": {
          "gc": 0,
          "ss": 1,
          "bp": 0
        },
        "availability": "common",
        "description": "Тяжёлый брусок железа с кузнечной отметиной."
      },
      {
        "name": "Уголь кузнечный",
        "img": "rock.png",
        "enc": 1,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 4
        },
        "availability": "common",
        "description": "Чёрные куски угля, дающие жар для горна."
      },
      {
        "name": "Кожаная обмотка",
        "img": "leather-jack.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 3
        },
        "availability": "common",
        "description": "Полоса кожи для рукояти и ножен."
      }
    ],
    "recipes": [
      {
        "name": "Кинжал",
        "type": "weapon",
        "img": "main-gauche.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 1,
          "bp": 0
        },
        "availability": "common",
        "description": "Короткий клинок с простой рукоятью — верный спутник в тёмных переулках.",
        "count": 1,
        "difficulty": "average",
        "slTarget": 10,
        "ingredients": [
          {
            "name": "Железный слиток",
            "count": 1
          },
          {
            "name": "Кожаная обмотка",
            "count": 1
          }
        ],
        "moneyBp": 3,
        "needsWorkshop": true,
        "timeDays": 0,
        "timeHours": 3,
        "timeMinutes": 0,
        "upgrades": [
          {
            "quality": "fine",
            "count": 1,
            "ingredientName": "Уголь кузнечный",
            "moneyBp": 6
          }
        ],
        "crit": {
          "sl": 8,
          "qualities": [
            "impale"
          ],
          "refund": true
        }
      },
      {
        "name": "Ручное оружие",
        "type": "weapon",
        "img": "hand-weapon.png",
        "enc": 1,
        "price": {
          "gc": 0,
          "ss": 2,
          "bp": 0
        },
        "availability": "common",
        "description": "Простой молот с окованным бойком, годный и в работе, и в драке.",
        "count": 1,
        "difficulty": "average",
        "slTarget": 10,
        "ingredients": [
          {
            "name": "Железный слиток",
            "count": 2
          },
          {
            "name": "Кожаная обмотка",
            "count": 1
          }
        ],
        "moneyBp": 6,
        "needsWorkshop": true,
        "timeDays": 0,
        "timeHours": 4,
        "timeMinutes": 0,
        "upgrades": [
          {
            "quality": "damaging",
            "count": 1,
            "ingredientName": "Уголь кузнечный",
            "moneyBp": 12
          }
        ]
      }
    ]
  },
  {
    "key": "carpenter",
    "skill": "Ремесло (Плотник)",
    "label": "Плотник",
    "ingredients": [
      {
        "name": "Древесина",
        "img": "raw-materials.png",
        "enc": 1,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 4
        },
        "availability": "common",
        "description": "Хорошая доска или брусок без сучков."
      },
      {
        "name": "Древко",
        "img": "raw-materials.png",
        "enc": 1,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 3
        },
        "availability": "common",
        "description": "Ровный гибкий шест для лука или древка."
      },
      {
        "name": "Тетива",
        "img": "rope-10-yards.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 5
        },
        "availability": "common",
        "description": "Крепкая жила, натянутая в струну."
      },
      {
        "name": "Железные гвозди",
        "img": "chisel.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 2
        },
        "availability": "common",
        "description": "Горсть кованых гвоздей для крепкой работы."
      }
    ],
    "recipes": [
      {
        "name": "Дубинка",
        "type": "weapon",
        "img": "baton.png",
        "enc": 1,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 8
        },
        "availability": "common",
        "description": "Тяжёлая палица из цельного дерева, простая и надёжная.",
        "count": 1,
        "difficulty": "average",
        "slTarget": 5,
        "ingredients": [
          {
            "name": "Древесина",
            "count": 1
          },
          {
            "name": "Железные гвозди",
            "count": 1
          }
        ],
        "moneyBp": 2,
        "needsWorkshop": false,
        "timeDays": 0,
        "timeHours": 1,
        "timeMinutes": 0,
        "crit": {
          "sl": 8,
          "qualities": [
            "practical"
          ],
          "refund": true
        }
      },
      {
        "name": "Короткий лук",
        "type": "weapon",
        "img": "shortbow.png",
        "enc": 1,
        "price": {
          "gc": 0,
          "ss": 2,
          "bp": 0
        },
        "availability": "common",
        "description": "Простой лук из гибкого тиса, годный для охоты и стычек.",
        "count": 1,
        "difficulty": "challenging",
        "slTarget": 10,
        "ingredients": [
          {
            "name": "Древко",
            "count": 2
          },
          {
            "name": "Тетива",
            "count": 1
          }
        ],
        "moneyBp": 6,
        "needsWorkshop": true,
        "timeDays": 0,
        "timeHours": 3,
        "timeMinutes": 0,
        "upgrades": [
          {
            "quality": "accurate",
            "count": 1,
            "ingredientName": "Тетива",
            "moneyBp": 12
          }
        ]
      }
    ]
  },
  {
    "key": "fletcher",
    "skill": "Ремесло (Лучник)",
    "label": "Лучник",
    "ingredients": [
      {
        "name": "Древко стрелы",
        "img": "raw-materials.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 2
        },
        "availability": "common",
        "description": "Тонкий ровный прут для стрелы или болта."
      },
      {
        "name": "Наконечник",
        "img": "chisel.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 3
        },
        "availability": "common",
        "description": "Кованый железный наконечник с остриём."
      },
      {
        "name": "Оперение",
        "img": "raw-materials.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 2
        },
        "availability": "common",
        "description": "Птичьи перья для стабилизации полёта."
      },
      {
        "name": "Тетива",
        "img": "rope-10-yards.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 5
        },
        "availability": "common",
        "description": "Крепкая жила, натянутая в струну."
      }
    ],
    "recipes": [
      {
        "name": "Стрелы",
        "type": "ammunition",
        "img": "bow.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 10
        },
        "availability": "common",
        "description": "Связка стрел с оперением и острыми наконечниками.",
        "count": 12,
        "difficulty": "average",
        "slTarget": 5,
        "ingredients": [
          {
            "name": "Древко стрелы",
            "count": 2
          },
          {
            "name": "Наконечник",
            "count": 1
          },
          {
            "name": "Оперение",
            "count": 1
          }
        ],
        "moneyBp": 3,
        "needsWorkshop": false,
        "timeDays": 0,
        "timeHours": 1,
        "timeMinutes": 0,
        "upgrades": [
          {
            "quality": "accurate",
            "count": 1,
            "ingredientName": "Оперение",
            "moneyBp": 6
          }
        ]
      },
      {
        "name": "Болты",
        "type": "ammunition",
        "img": "bow.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 12
        },
        "availability": "common",
        "description": "Короткие тяжёлые болты для арбалета, с толстым древком.",
        "count": 12,
        "difficulty": "average",
        "slTarget": 5,
        "ingredients": [
          {
            "name": "Древко стрелы",
            "count": 2
          },
          {
            "name": "Наконечник",
            "count": 2
          }
        ],
        "moneyBp": 3,
        "needsWorkshop": false,
        "timeDays": 0,
        "timeHours": 1,
        "timeMinutes": 30,
        "crit": {
          "sl": 8,
          "qualities": [
            "damaging"
          ],
          "refund": true
        }
      }
    ]
  },
  {
    "key": "chandler",
    "skill": "Ремесло (Свечник)",
    "label": "Свечник",
    "ingredients": [
      {
        "name": "Пчелиный воск",
        "img": "raw-materials.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 4
        },
        "availability": "common",
        "description": "Жёлтый брусок воска с медовым запахом."
      },
      {
        "name": "Сальный жир",
        "img": "raw-materials.png",
        "enc": 1,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 3
        },
        "availability": "common",
        "description": "Тяжёлый ком жира, из которого топят сало."
      },
      {
        "name": "Фитиль",
        "img": "rope-10-yards.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 1
        },
        "availability": "common",
        "description": "Скрученная нить, что держит пламя."
      },
      {
        "name": "Лампадное масло",
        "img": "wine-bottle.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 5
        },
        "availability": "common",
        "description": "Бутыль дешёвого масла для ламп и лампад."
      }
    ],
    "recipes": [
      {
        "name": "Свечи",
        "type": "trapping",
        "trappingType": "misc",
        "img": "candle-dozen.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 8
        },
        "availability": "common",
        "description": "Связка сальных свечей, чадящих и дающих неровный свет.",
        "count": 6,
        "difficulty": "average",
        "slTarget": 5,
        "ingredients": [
          {
            "name": "Сальный жир",
            "count": 2
          },
          {
            "name": "Фитиль",
            "count": 1
          }
        ],
        "moneyBp": 2,
        "needsWorkshop": false,
        "timeDays": 0,
        "timeHours": 1,
        "timeMinutes": 0,
        "upgrades": [
          {
            "quality": "durable",
            "count": 1,
            "ingredientName": "Пчелиный воск",
            "moneyBp": 4
          }
        ]
      },
      {
        "name": "Лампадное масло",
        "type": "trapping",
        "trappingType": "misc",
        "img": "wine-bottle.png",
        "enc": 0,
        "price": {
          "gc": 0,
          "ss": 0,
          "bp": 10
        },
        "availability": "common",
        "description": "Бутыль мутного масла, что горит долго и коптит чёрным дымом.",
        "count": 1,
        "difficulty": "average",
        "slTarget": 5,
        "ingredients": [
          {
            "name": "Лампадное масло",
            "count": 2
          },
          {
            "name": "Пчелиный воск",
            "count": 1
          }
        ],
        "moneyBp": 3,
        "needsWorkshop": false,
        "timeDays": 0,
        "timeHours": 0,
        "timeMinutes": 30,
        "crit": {
          "sl": 8,
          "qualities": [
            "practical"
          ],
          "refund": true
        }
      }
    ]
  }
];
