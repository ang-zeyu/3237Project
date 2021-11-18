/*
 * Our custom application interface for the song burst service
 *
 * The actual service is in songburstservice.c / h
 *
 * NOTE: This is adapted from the movementservice.h as a starting point.
 *       You may see various old references to it therefore.
 */

#ifndef EXCLUDE_MOV
/*********************************************************************
 * INCLUDES
 */
#include <ti/sysbios/knl/Semaphore.h>
#include <ti/sysbios/knl/Queue.h>
#include <xdc/runtime/System.h>

#include "gatt.h"
#include "gattservapp.h"

#include "board.h"
#include "songburstservice.h"
#include "sensortag_song_burst.h"
#include "SensorMpu9250.h"
#include "SensorTagTest.h"

#include "SensorOpt3001.h"
#include "SensorHdc1000.h"

#include "SensorUtil.h"
#include "util.h"
#include "string.h"

/*********************************************************************
 * MACROS
 */
#define MOVEMENT_INACT_CYCLES   (MOVEMENT_INACT_TIMEOUT * \
                                (10000/sensorPeriod) / 10)

/*********************************************************************
 * CONSTANTS and MACROS
 */
// How often to perform sensor reads (milliseconds)
#define SENSOR_DEFAULT_PERIOD     100

// Length of the data for this sensor
#define MOVEMENT_SENSOR_DATA_LEN           MOVEMENT_DATA_LEN
#define TOTAL_SENSOR_DATA_LEN     378

// Event flag for this sensor
#define SENSOR_EVT                ST_GYROSCOPE_SENSOR_EVT

// Movement task states
#define APP_STATE_ERROR           0xFF
#define APP_STATE_OFF             0
#define APP_STATE_IDLE            1
#define APP_STATE_ACTIVE          2

// Movement task configuration
#define MOVEMENT_INACT_TIMEOUT    10     // 10 seconds
#define GYR_SHAKE_THR             10.0
#define WOM_THR                   10

// Configuration bit-masks (bits 0-6 defined in sensor_mpu9250.h)
#define MOV_WOM_ENABLE            0x0080
#define MOV_MASK_WOM_THRESHOLD    0x3C00 // TBD
#define MOV_MASK_INACT_TIMEOUT    0xC000 // TBD

/*********************************************************************
 * TYPEDEFS
 */

/*********************************************************************
 * GLOBAL VARIABLES
 */

static int8_t timeStepCounter = 0;

/*********************************************************************
 * EXTERNAL VARIABLES
 */

/*********************************************************************
 * EXTERNAL FUNCTIONS
 */

/*********************************************************************
 * LOCAL VARIABLES
 */
static Clock_Struct periodicClock;
static uint16_t sensorPeriod;
static volatile bool sensorReadScheduled;
static uint8_t sensorData[TOTAL_SENSOR_DATA_LEN];

static uint16_t OPTICAL_START_OFFSET = 360;
static uint16_t HUMIDITY_START_OFFSET = 366;

// Application state variables

// MPU config:
// bit 0-2:   accelerometer enable(z,y,x)
// bit 3-5:   gyroscope enable (z,y,x)
// bit 6:     magnetometer enable
// bit 7:     WOM enable
// bit 8-9:   accelerometer range (2,4,8,16)
static uint16_t mpuConfig;

static uint8_t appState;
static volatile bool mpuDataRdy;
static uint32_t nActivity;
static uint8_t movThreshold;
static uint8_t mpuIntStatus;
static uint8_t nMotions;

/*********************************************************************
 * LOCAL FUNCTIONS
 */
static void sensorChangeCB(uint8_t paramID);
static void initCharacteristicValue(uint8_t paramID, uint8_t value,
                                    uint16_t paramLen);
static void SensorTagSong_clockHandler(UArg arg);
static void appStateSet(uint8_t newState);
static void SensorTagSong_processInterrupt(void);

/*********************************************************************
 * PROFILE CALLBACKS
 */
static sensorCBs_t sensorCallbacks =
{
  sensorChangeCB,  // Characteristic value change callback
};


/*********************************************************************
 * PUBLIC FUNCTIONS
 */

/*********************************************************************
 * @fn      SensorTagSong_init
 *
 * @brief   Initialization function for the SensorTag movement sub-application
 *
 * @param   none
 *
 * @return  none
 */
void SensorTagSong_init(void)
{
  // Add service
  Song_addService();

  // Register callbacks with profile
  Song_registerAppCBs(&sensorCallbacks);

  // Initialize the module state variables
  mpuConfig = ST_CFG_SENSOR_DISABLE;
  sensorPeriod = SENSOR_DEFAULT_PERIOD;
  sensorReadScheduled = false;

  appState = APP_STATE_OFF;
  nMotions = 0;

  SensorOpt3001_init();
  SensorOpt3001_enable(false);

  if (SensorMpu9250_init())
  {
    SensorTagSong_reset();
    SensorMpu9250_registerCallback(SensorTagSong_processInterrupt);
  }

  SensorHdc1000_init();

  // Initialize characteristics
  initCharacteristicValue(SENSOR_PERI,
                          SENSOR_DEFAULT_PERIOD / SENSOR_PERIOD_RESOLUTION,
                          sizeof(uint8_t));

  // Create continuous clock for internal periodic events.
  Util_constructClock(&periodicClock, SensorTagSong_clockHandler,
                      100, sensorPeriod, false, 0);
}

/*********************************************************************
 * @fn      SensorTagSong_processSensorEvent
 *
 * @brief   SensorTag Movement sensor event processor.
 *
 * @param   none
 *
 * @return  none
 */
void SensorTagSong_processSensorEvent(void)
{
  if (sensorReadScheduled)
  {
    if (timeStepCounter >= 30) {
        // Send the burst
        if (Song_setParameter(SENSOR_DATA, TOTAL_SENSOR_DATA_LEN, sensorData)) {
            timeStepCounter = -2;
        }
        sensorReadScheduled = false;
        timeStepCounter = -1;
        return;
    } else if (timeStepCounter == -1) {
        // Stop scheduled data measurements
        Util_stopClock(&periodicClock);
        return;
    }
    //System_printf("SensorTagSong_processSensorEvent %d\n", timeStepCounter);
    //System_flush();

    uint8_t axes;

    axes = mpuConfig & MPU_AX_ALL;

    if ((axes != ST_CFG_SENSOR_DISABLE) && (axes != ST_CFG_ERROR))
    {
      // Get interrupt status (clears interrupt)
      mpuIntStatus = SensorMpu9250_irqStatus();

      // Process gyro and accelerometer
      if (mpuDataRdy || appState == APP_STATE_ACTIVE)
      {
        if (mpuIntStatus & MPU_MOVEMENT)
        {
          // Motion detected (small filter)
          nMotions++;
          if (nMotions == 2)
          {
            nActivity = MOVEMENT_INACT_CYCLES;
          }
        }
        else if (mpuIntStatus & MPU_DATA_READY)
        {
          uint16_t offset = timeStepCounter * 12;
          // Read gyro data
          SensorMpu9250_gyroRead((uint16_t*)&sensorData[offset]);

          // Read accelerometer data
          SensorMpu9250_accRead((uint16_t*)&sensorData[offset + 6]);
        }

        mpuDataRdy = false;

        if (appState == APP_STATE_ACTIVE && !!(mpuConfig & MPU_AX_MAG))
        {
          uint8_t status;

          status = SensorMpu9250_magRead((int16_t*)&sensorData[12]);

          // Always measure magnetometer (not interrupt driven)
          if (status == MAG_BYPASS_FAIL)
          {
            // Idle on error
            nActivity = 0;
            appState = APP_STATE_ERROR;
          }
          else if (status != MAG_STATUS_OK)
          {
            SensorMpu9250_magReset();
          }
        }
      }

      if (nActivity>0)
      {
        if (appState != APP_STATE_ACTIVE)
        {
          // Transition to active state
          appState = APP_STATE_ACTIVE;
          nMotions = 0;
          if (SensorMpu9250_reset())
          {
            SensorMpu9250_enable(axes);
          }
        }

        if (mpuConfig & MOV_WOM_ENABLE)
        {
          nActivity--;
        }
      }
      else
      {
        if (appState != APP_STATE_IDLE)
        {
          // Transition from active to idle state
          nMotions = 0;
          appState = APP_STATE_IDLE;
          if (SensorMpu9250_reset())
          {
            SensorMpu9250_enableWom(movThreshold);
          }
        }
      }

      // 1. Temperature, Humidity, Optical
      if (timeStepCounter % 10 == 0) {
          uint16_t iteration = timeStepCounter / 10;

          uint8_t *opt_offsetted = sensorData + OPTICAL_START_OFFSET + (iteration * 2);
          SensorOpt3001_read((uint16_t*)opt_offsetted);

          uint8_t *temphum_offsetted = sensorData + HUMIDITY_START_OFFSET + (iteration * 4);
          SensorHdc1000_read((uint16_t*)&temphum_offsetted[0], (uint16_t*)&temphum_offsetted[2]);
      }
    }

    timeStepCounter += 1;

    sensorReadScheduled = false;
  }
}

/*********************************************************************
 * @fn      SensorTagSong_processCharChangeEvt
 *
 * @brief   SensorTag Movement event handling
 *
 * @param   paramID - identifies which characteristic has changed
 *
 * @return  none
 */
void SensorTagSong_processCharChangeEvt(uint8_t paramID)
{
  uint16_t newCfg;
  uint8_t newValue8;

  switch (paramID)
  {
  case SENSOR_CONF:
    if ((SensorTag_testResult() & SENSOR_MOV_TEST_BM) == 0)
    {
      mpuConfig = ST_CFG_ERROR;
    }

    if (mpuConfig != ST_CFG_ERROR)
    {
      Song_getParameter(SENSOR_CONF, &newCfg);

      if ((newCfg & MPU_AX_ALL) == ST_CFG_SENSOR_DISABLE)
      {
        // All axes off, turn off device power
        mpuConfig = newCfg;
        appStateSet(APP_STATE_OFF);
      }
      else
      {
        // Some axes on; power up and activate MPU
        mpuConfig = newCfg;
        appStateSet(APP_STATE_ACTIVE);
        if (SensorMpu9250_powerIsOn())
        {
          DELAY_MS(5);
          mpuConfig = newCfg;
        }
      }

      Song_setParameter(SENSOR_CONF, sizeof(mpuConfig), (uint8_t*)&mpuConfig);
    }
    else
    {
      // Make sure the previous characteristics value is restored
      initCharacteristicValue(SENSOR_CONF, mpuConfig, sizeof(mpuConfig));
    }

    // Data initially zero
    initCharacteristicValue(SENSOR_DATA, 0, TOTAL_SENSOR_DATA_LEN); // TODO correct?
    break;

  case SENSOR_PERI:
    Song_getParameter(SENSOR_PERI, &newValue8);
    sensorPeriod = newValue8 * SENSOR_PERIOD_RESOLUTION;
    Util_rescheduleClock(&periodicClock,sensorPeriod);
    break;

  default:
    // Should not get here
    break;
  }
}

/*********************************************************************
 * @fn      SensorTagSong_reset
 *
 * @brief   Reset characteristics and disable sensor
 *
 * @param   none
 *
 * @return  none
 */
void SensorTagSong_reset(void)
{
  initCharacteristicValue(SENSOR_DATA, 0, TOTAL_SENSOR_DATA_LEN);
  mpuConfig = ST_CFG_SENSOR_DISABLE | (ACC_RANGE_8G << 8);
  Song_setParameter(SENSOR_CONF, sizeof(mpuConfig), (uint8_t*)&mpuConfig);

  // Remove power from the MPU
  appStateSet(APP_STATE_OFF);
}


/*********************************************************************
* Private functions
*/

/*********************************************************************
 * @fn      SensorTagSong_processInterrupt
 *
 * @brief   Interrupt handler for MPU
 *
 * @param   none
 *
 * @return  none
 */
static void SensorTagSong_processInterrupt(void)
{
  // Wake up the application thread
  mpuDataRdy = true;
  sensorReadScheduled = true;
  Semaphore_post(sem);
}

/*********************************************************************
 * @fn      SensorTagSong_clockHandler
 *
 * @brief   Handler function for clock time-outs.
 *
 * @param   arg - not used
 *
 * @return  none
 */
static void SensorTagSong_clockHandler(UArg arg)
{
  // Schedule readout periodically
  sensorReadScheduled = true;
  Semaphore_post(sem);
}


/*********************************************************************
 * @fn      sensorChangeCB
 *
 * @brief   Callback from Movement Service indicating a value change
 *
 * @param   paramID - parameter ID of the value that was changed.
 *
 * @return  none
 */
static void sensorChangeCB(uint8_t paramID)
{
  // Wake up the application thread
  SensorTag_charValueChangeCB(SERVICE_ID_MOV, paramID);
}


/*********************************************************************
 * @fn      initCharacteristicValue
 *
 * @brief   Initialize a characteristic value
 *
 * @param   paramID - parameter ID of the value is to be cleared
 *
 * @param   value - value to initialize with
 *
 * @param   paramLen - length of the parameter
 *
 * @return  none
 */
static void initCharacteristicValue(uint8_t paramID, uint8_t value,
                                    uint16_t paramLen)
{
  memset(sensorData,value,paramLen);
  Song_setParameter(paramID, paramLen, sensorData);
}

/*******************************************************************************
 * @fn      appStateSet
 *
 * @brief   Set the application state
 *
 */
static void appStateSet(uint8_t newState)
{
  if (newState == APP_STATE_OFF)
  {
    appState = APP_STATE_OFF;

    SensorMpu9250_enable(0);
    SensorMpu9250_powerOff();

    SensorOpt3001_enable(false);

    // Stop scheduled data measurements
    Util_stopClock(&periodicClock);
  }

  if (newState == APP_STATE_ACTIVE || newState == APP_STATE_IDLE)
  {
    appState = APP_STATE_ACTIVE;
    nActivity = MOVEMENT_INACT_CYCLES;
    movThreshold = WOM_THR;
    mpuIntStatus = 0;
    mpuDataRdy = false;

    SensorMpu9250_powerOn();
    SensorMpu9250_enable(mpuConfig & 0xFF);
    SensorMpu9250_accSetRange(mpuConfig>>8 & 0x03);

    SensorOpt3001_enable(true);
    uint16_t data;
    SensorOpt3001_read(&data); // read once to get rid of the 0 value

    SensorHdc1000_start();
    DELAY_MS(15);

    if (newState == APP_STATE_ACTIVE)
    {
      timeStepCounter = 0;
      // Start scheduled data measurements
      Util_startClock(&periodicClock);
    }
    else
    {
      // Stop scheduled data measurements
      Util_stopClock(&periodicClock);
    }
  }
}
#endif // EXCLUDE_MOV

/*********************************************************************
*********************************************************************/
