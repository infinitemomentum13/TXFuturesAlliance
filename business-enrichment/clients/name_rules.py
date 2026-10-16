"""Deterministic name-keyword -> NAICS inference.

Last-resort free tier: many taxpayer names carry their industry
("ABC AUTO REPAIR", "LA FE TAQUERIA", "X HOLDINGS LTD"). Ordered regex
rules on the normalized name produce a NAICS code. Clearly labeled
NAICS_Source="name_rule" with fixed confidence 70 so downstream users can
filter inferred values from sourced ones.
"""

import logging
import re

from .base import BaseClient, Candidate
from matching import normalize_name

logger = logging.getLogger(__name__)

# Ordered (pattern, naics, label) — first match wins. More specific rules
# must precede generic ones.
RULES = [
    # --- food & drink ----------------------------------------------------
    (r"\b(taqueria|taco shop|tacos|taco truck)\b", "722513", "taco shop"),
    (r"\b(tortilleria)\b", "311830", "tortilla mfg"),
    (r"\b(panaderia|donut|donuts?|paleteria|neveria|ice cream|boba|"
     r"smoothie|juice bar|snow cone|raspa|coffee|cafe|espresso)\b",
     "722515", "snack/beverage"),
    (r"\b(pizza|pizzeria|burger|burgers|sub ?way|sandwich|wings|"
     r"fried chicken|pollo|chicken|hot dog|fast food|drive.?thru|"
     r"burger king|whataburger|wendy|sonic)\b", "722513", "limited svc food"),
    (r"\b(restaurant|restaurante|rest |grill|steak ?house|steakhouse|"
     r"cocina|kitchen|bbq|bar.?b.?cue|seafood|mariscos|buffet|diner|"
     r"eatery|churrascaria|sushi|pho|ramen|tamales)\b", "722511", "restaurant"),
    (r"\b(food truck|lonchera)\b", "722330", "food truck"),
    (r"\b(catering|banquet)\b", "722320", "catering"),
    (r"\b(cantina|night ?club|nightclub|lounge|sports ?bar|bar &|"
     r"bar and|michelada|watering hole|cantina)\b", "722410", "bar"),
    (r"\bbakery\b|\bbakeries\b", "445291", "bakery retail"),
    (r"\bmeat market|carniceria", "445210", "meat market"),
    (r"\b(liquor|licoreria|wine (shop|store)|beer (depot|barn|store))\b",
     "445310", "liquor"),
    (r"\b(grocery|supermarket|super market|food mart|marketplace|"
     r"mercado)\b", "445110", "grocery"),
    (r"\b(mini ?mart|convenience|seven.?eleven|stripes|corner store|"
     r"quick (stop|mart)|gas (station|& ?go)|fuel)\b", "445120", "convenience"),
    # --- automotive ------------------------------------------------------
    (r"\b(transmission|mufl?ler)\b", "811113", "transmission/muffler"),
    (r"\b(oil change|lube|lubr)\b", "811191", "oil change"),
    (r"\b(car wash|auto spa)\b", "811192", "car wash"),
    (r"\b(body ?shop|collision|auto body|paint & body)\b", "811121",
     "body shop"),
    (r"\b(glass|windshield)\b.*\b(auto|car)\b|\bauto glass\b",
     "811122", "auto glass"),
    (r"\b(tire|llanta|tyre)\b", "441320", "tire dealer"),
    (r"\b(auto parts|auto supply|parts (store|shop))\b", "441310",
     "auto parts"),
    (r"\b(auto (sales|plaza|mall|world|center|depot)|used cars?|"
     r"car sales|motors|auto sales|car lot|dealership)\b", "441120",
     "used car dealer"),
    (r"\b(auto repair|mechanic|taller|garage|automotive|auto service|"
     r"brakes|a/c auto|radiator)\b", "811111", "auto repair"),
    (r"\b(towing|wrecker|tow truck)\b", "488410", "towing"),
    (r"\b(detailing|car detail)\b", "811192", "detailing"),
    # --- health -----------------------------------------------------------
    (r"\b(dental|dentist|orthodon)\b", "621210", "dental"),
    (r"\b(pharmacy|farmacia)\b", "446110", "pharmacy"),
    (r"\b(optical|optometrist|eye care|vision)\b", "621320", "optometry"),
    (r"\b(chiropract)\b", "621310", "chiro"),
    (r"\b(physical therapy|rehab|physiotherapy)\b", "621340", "pt/rehab"),
    (r"\b(home health|hospice|homecare|caregiver)\b", "621610",
     "home health"),
    (r"\b(dialysis)\b", "621492", "dialysis"),
    (r"\b(laborator|medical lab|clinical lab|imaging|radiolog|"
     r"mri|ultrasound)\b", "621511", "lab/imaging"),
    (r"\b(mental health|counsel|behavioral|psych)\b", "621330",
     "mental health"),
    (r"\b(veterinar|animal (hospital|clinic)|vet clinic)\b", "541940",
     "veterinary"),
    (r"\b(clinic|medical|health|urgent care|pediatric|family (med|practice)|"
     r"physician|doctor|md\b|wellness)\b", "621111", "physician/clinic"),
    # --- personal care ----------------------------------------------------
    (r"\b(nail|nails)\b", "812113", "nail salon"),
    (r"\b(barber)\b", "812111", "barber"),
    (r"\b(salon|beauty|hair|estetica|esthetics|cosmetolog)\b", "812112",
     "salon"),
    (r"\b(spa|massage)\b", "812199", "spa/massage"),
    (r"\b(tattoo|piercing)\b", "812199", "tattoo"),
    (r"\b(laundr|lavanderia|dry ?clean|washateria)\b", "812310", "laundry"),
    (r"\b(funeral|funeraria|memorial chapel)\b", "812210", "funeral"),
    (r"\b(cemetery|cementerio)\b", "812220", "cemetery"),
    (r"\b(day ?care|child ?care|learning (center|academy)|pre.?k|"
     r"preschool|head start)\b", "624410", "childcare"),
    (r"\b(pet (shop|store|supply)|pet supplies)\b", "453910", "pet store"),
    (r"\b(grooming|pet grooming|pet spa)\b", "812910", "pet grooming"),
    # --- finance / real estate --------------------------------------------
    (r"\b(bail ?bonds?)\b", "812990", "bail bonds"),
    (r"\b(pawn ?shop|pawnshop|empe)\b", "522298", "pawn"),
    (r"\b(check cash|money (transfer|order)|envios)\b", "522390",
     "money services"),
    (r"\b(credit union)\b", "522130", "credit union"),
    (r"\b(bank\b|national bank|state bank)\b", "522110", "bank"),
    (r"\b(mortgage|lending|loans?|finance (co|company))\b", "522291",
     "consumer lending"),
    (r"\b(insurance|aseguranza)\b", "524210", "insurance"),
    (r"\b(title (co|company|services?)|escrow)\b", "541191",
     "title/escrow"),
    (r"\b(notary)\b", "541120", "notary"),
    (r"\b(accounting|bookkeep|cpa\b|tax (service|prep|office)|"
     r"income tax|payroll)\b", "541211", "accounting/tax"),
    (r"\b(real ?estate|realty|realtor)\b", "531210", "real estate agent"),
    (r"\b(property management|apartments?|multifamily)\b", "531311",
     "property mgmt"),
    (r"\b(self.?storage|mini.?storage|storage units?)\b", "531130",
     "self storage"),
    (r"\b(holdings?|capital|ventures?|investments?|partners\b|"
     r"asset management|enterprises)\b", "551112", "holding company"),
    (r"\b(properties|property)\b", "531120", "real estate holding"),
    (r"\b(trust)\b", "525920", "trust"),
    (r"\b(foundation|charity)\b", "813211", "foundation"),
    # --- professional services --------------------------------------------
    (r"\b(law (office|firm|group)|attorneys?|abogado|legal)\b",
     "541110", "legal"),
    (r"\b(engineer|ingenieria)\b", "541330", "engineering"),
    (r"\b(architect)\b", "541310", "architecture"),
    (r"\b(survey)\b", "541370", "surveying"),
    (r"\b(accountant)\b", "541211", "accounting"),
    (r"\b(marketing|advertis|media|public relations|pr firm)\b",
     "541810", "advertising"),
    (r"\b(consulting|consultants?|consultores?)\b", "541611",
     "consulting"),
    (r"\b(staffing|employment|temp agency|recruiting)\b", "561311",
     "staffing"),
    (r"\b(web (design|development)|software|tech|technology|"
     r"it (services|solutions)|computer|cyber)\b", "541511", "it services"),
    (r"\b(security (guard|services|company|patrol)|security svc)\b",
     "561612", "security"),
    (r"\b(photograph|photo (studio|graphy)|portrait)\b", "541921",
     "photography"),
    (r"\b(printing|print shop|copies|copy center)\b", "323111",
     "printing"),
    (r"\b(sign (company|shop|works)|signs)\b", "339950", "signs"),
    (r"\b(graphic design|design studio)\b", "541430", "graphic design"),
    (r"\b(translation|interpreter)\b", "541930", "translation"),
    (r"\b(bailiff|process server)\b", "561499", "process server"),
    # --- trades / construction ----------------------------------------------
    (r"\b(roofing|roof)\b", "238160", "roofing"),
    (r"\b(electric|electrical)\b", "238210", "electrical"),
    (r"\b(plumbing|plomeria|sewer|drain)\b", "238220", "plumbing"),
    (r"\b(a/?c\b|hvac|air condition|refrigeration|heating)\b",
     "238220", "hvac"),
    (r"\b(painting|painter|drywall)\b", "238320", "painting"),
    (r"\b(floor|flooring|tile|ceramic)\b", "238330", "flooring"),
    (r"\b(concrete|cement|masonry|brick)\b", "238110", "concrete"),
    (r"\b(fence|fencing|cercas)\b", "238990", "fencing"),
    (r"\b(solar|solar panel)\b", "238290", "solar install"),
    (r"\b(septic)\b", "562991", "septic"),
    (r"\b(welding|welder|herreria|iron works?|metal works?)\b",
     "811310", "welding"),
    (r"\b(construction|contractor|builder|remodel|home improvement|"
     r"construccion|contracting)\b", "236118", "construction"),
    (r"\b(landscap|lawn|tree (service|trim|care)|yard)\b", "561730",
     "landscaping"),
    (r"\b(pest control|exterminat|fumigat)\b", "561710", "pest control"),
    (r"\b(cleaning|janitor|maid|limpia|lavanderia comercial)\b",
     "561720", "janitorial"),
    (r"\b(pool (service|clean|suppl)|piscina)\b", "561790", "pool svc"),
    # --- transport / logistics ----------------------------------------------
    (r"\b(trucking|freight|logistics?|transport|hauling|hot ?shot|"
     r"carriers?)\b", "484110", "trucking"),
    (r"\b(moving|movers|mudanzas)\b", "484210", "moving"),
    (r"\b(taxi|shuttle|transportation service)\b", "485999", "taxi/shuttle"),
    (r"\b(delivery|courier|mensajeria)\b", "492210", "courier"),
    (r"\b(warehouse|warehousing)\b", "493110", "warehousing"),
    (r"\b(import|export|trading|distrib|wholesale|supply co)\b",
     "423990", "wholesale/trading"),
    # --- retail ---------------------------------------------------------------
    (r"\b(dollar (store|general|tree)|discount|variety|99 ?cent|"
     r"la economia)\b", "452319", "variety store"),
    (r"\b(department store|walmart|target|ross|marshalls|burlington)\b",
     "452210", "dept store"),
    (r"\b(thrift|second ?hand|resale|flea market|pulga|used merchandise)\b",
     "453310", "thrift"),
    (r"\b(clothing|boutique|apparel|ropa|uniforms?|western wear|"
     r"quinceanera|bridal|tuxedo)\b", "448140", "clothing"),
    (r"\b(shoe|zapateria|boots)\b", "448210", "shoes"),
    (r"\b(jewelry|joyeria|pawn)\b", "448310", "jewelry"),
    (r"\b(furniture|muebleria|mattress|appliance)\b", "442110",
     "furniture/appliance"),
    (r"\b(electronics|electronicos|audio|stereo)\b", "443142",
     "electronics"),
    (r"\b(cell ?phone|wireless|cellular|phone repair|cricket|boost mobile)\b",
     "443142", "wireless retail"),
    (r"\b(florist|flowers|floreria)\b", "453110", "florist"),
    (r"\b(gift|novelty|souvenir|regalos)\b", "453220", "gift"),
    (r"\b(hardware|ferreteria|home improvement|building materials)\b",
     "444110", "hardware"),
    (r"\b(smoke|vape|tobacco|cigar)\b", "453991", "tobacco"),
    (r"\b(cbd|supplement|nutrition|vitamin)\b", "446191", "supplements"),
    (r"\b(beauty supply|cosmetics)\b", "446120", "beauty supply"),
    (r"\b(office (supply|supplies|furniture))\b", "453210",
     "office supply"),
    (r"\b(sporting goods|gun|firearm|ammo|ammo store)\b", "451110",
     "sporting goods"),
    (r"\b(music (store|shop)|instruments)\b", "451140", "music store"),
    (r"\b(book ?store|books|libreria)\b", "451211", "bookstore"),
    (r"\b(party (supply|rental|rentals)|bounce house|moonwalk)\b",
     "532299", "party rental"),
    # --- hospitality ----------------------------------------------------------
    (r"\b(hotel|motel|inn|suites|lodge|lodging|bed & breakfast|b&b)\b",
     "721110", "lodging"),
    (r"\b(rv park|rv resort|campground|trailer park)\b", "721211",
     "rv park"),
    # --- recreation / other services ------------------------------------------
    (r"\b(gym|fitness|martial arts|crossfit|boxing|kickboxing|yoga)\b",
     "713940", "fitness"),
    (r"\b(dance (studio|academy|school)|music (school|academy|lessons))\b",
     "611610", "dance/music school"),
    (r"\b(driving school|truck driving|cdl)\b", "611692", "driving school"),
    (r"\b(school|academy|colegio|institute)\b", "611110", "school"),
    (r"\b(laundromat|wash ?n ?fold)\b", "812310", "laundromat"),
    (r"\b(movie|cinema|theater|theatre)\b", "512131", "cinema"),
    (r"\b(billiard|pool hall|arcade|game room|gaming)\b", "713990",
     "amusement"),
    (r"\b(bowling)\b", "713950", "bowling"),
    (r"\b(bingo|game room|maquinitas)\b", "713290", "gambling"),
    (r"\b(church|iglesia|ministr|templo|apostolic|worship|prayer|"
     r"bible|christian|catholic|baptist|methodist|pentecost|parish|"
     r"mission\b|ministry)\b", "813110", "religious"),
    (r"\b(association|asociacion|civic|club inc|rotary|lions club|"
     r" veterans of|vfw)\b", "813410", "civic org"),
    (r"\b(animal shelter|rescue|humane)\b", "813312", "animal rescue"),
    # --- resources ------------------------------------------------------------
    (r"\b(oil|gas|petroleum|oilfield|drilling|energy|pipeline)\b",
     "213112", "oilfield support"),
    # 'ranch' alone is too ambiguous in this dataset — subdivision/holding
    # entities like "ALAMO RANCH 46 LLC" are property, not agriculture.
    (r"\b(cattle|livestock|ranching)\b", "112111", "cattle ranch"),
    (r"\b(farm|agricultur|crop)\b", "111998", "farm"),
    (r"\b(nursery|garden center|plants)\b", "444220", "nursery"),
]

_COMPILED = [(re.compile(p, re.IGNORECASE), naics, label)
             for p, naics, label in RULES]


def infer_naics(name):
    """Return (naics, label) for the first matching rule, else None."""
    text = " " + normalize_name(name) + " "
    for pattern, naics, label in _COMPILED:
        if pattern.search(text):
            return naics, label
    return None, None


class NameRulesClient(BaseClient):
    name = "name_rule"
    provides = ("naics",)
    local = True
    CONFIDENCE = 70  # inferred, not sourced — fixed lower confidence

    def lookup(self, record):
        naics, label = infer_naics(record["name"])
        if not naics:
            return []
        return [
            Candidate(
                name=record["name"],  # self-match → name score is max
                naics_code=naics,
                employees=None,
                zip=record.get("zip", ""),
                confidence=self.CONFIDENCE,
                raw={"rule": label},
            )
        ]
